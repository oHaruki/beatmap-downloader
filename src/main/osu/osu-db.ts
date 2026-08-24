// Parser for osu!(stable)'s osu!.db, the game's own index of every imported
// beatmap. It carries the real BeatmapSetID for each difficulty, so it sees
// maps whose Songs folder was never named "<id> Artist - Title" (manual
// imports, anything this app downloaded, folders the user renamed).
//
// Layout reference: https://github.com/ppy/osu/wiki/Legacy-database-file-structure
// Every field has to be walked in order because entries are variable length;
// a single wrong offset desyncs the rest of the file, so the reader throws on
// anything implausible and the caller falls back to the folder-name scan.
import { promises as fs } from "fs";

// Sanity bounds. These only exist to turn a desynced read into a thrown error
// early, instead of letting it allocate wildly or grind through garbage.
const MIN_VERSION = 20070000;
const MAX_VERSION = 21000000;
const MAX_BEATMAPS = 2_000_000;
const MAX_LIST_ENTRIES = 1_000_000;

// osu! stores AR/CS/HP/OD as bytes and omits star ratings below this version.
const FLOAT_DIFFICULTY_VERSION = 20140609;
// Entries stopped being prefixed with their own byte length at this version.
const NO_ENTRY_SIZE_VERSION = 20191106;
// Bytes allowed after the last entry: an int of user permissions, plus room
// for a trailing field a future format revision might append.
const TRAILING_SLACK = 16;

class Reader {
  offset = 0;

  constructor(private readonly buf: Buffer) {}

  get remaining(): number {
    return this.buf.length - this.offset;
  }

  private require(bytes: number): void {
    if (this.offset + bytes > this.buf.length) {
      throw new Error(`osu!.db ended early at offset ${this.offset}`);
    }
  }

  skip(bytes: number): void {
    if (bytes < 0) throw new Error(`negative skip (${bytes}) at offset ${this.offset}`);
    this.require(bytes);
    this.offset += bytes;
  }

  byte(): number {
    this.require(1);
    return this.buf.readUInt8(this.offset++);
  }

  int(): number {
    this.require(4);
    const value = this.buf.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  // ULEB128, as used for string lengths. Built with arithmetic rather than
  // bit shifts so a corrupt length can't wrap around into a small number.
  private uleb128(): number {
    let result = 0;
    let shift = 1;
    for (;;) {
      const b = this.byte();
      result += (b & 0x7f) * shift;
      if ((b & 0x80) === 0) return result;
      shift *= 128;
      if (shift > 2 ** 35) throw new Error(`runaway ULEB128 at offset ${this.offset}`);
    }
  }

  string(): void {
    const marker = this.byte();
    if (marker === 0x00) return; // null string, no payload
    if (marker !== 0x0b) {
      throw new Error(`bad string marker 0x${marker.toString(16)} at offset ${this.offset - 1}`);
    }
    this.skip(this.uleb128());
  }

  // Star ratings are stored as .NET Int-Double pairs, each value prefixed by
  // its TypeCode. Dispatching on that byte instead of assuming Int+Double
  // keeps this working through format changes (recent builds write the rating
  // as a Single, 0x0c, rather than a Double).
  typedValue(): void {
    const type = this.byte();
    switch (type) {
      case 0x00: return; // null
      case 0x01: case 0x02: case 0x06: case 0x0a: return this.skip(1); // bool, byte, sbyte, char
      case 0x03: case 0x07: return this.skip(2); // ushort, short
      case 0x04: case 0x08: case 0x0c: return this.skip(4); // uint, int, single
      case 0x05: case 0x09: case 0x0d: case 0x0f: return this.skip(8); // ulong, long, double, datetime
      case 0x0b: return this.string();
      case 0x0e: return this.skip(16); // decimal
      default:
        throw new Error(`unknown value type 0x${type.toString(16)} at offset ${this.offset - 1}`);
    }
  }

  typedPairList(): void {
    const count = this.int();
    if (count < 0 || count > MAX_LIST_ENTRIES) {
      throw new Error(`implausible pair count ${count} at offset ${this.offset - 4}`);
    }
    for (let i = 0; i < count; i++) {
      this.typedValue(); // mod combination
      this.typedValue(); // star rating for that combination
    }
  }
}

function readBeatmapEntry(r: Reader, version: number): number {
  if (version < NO_ENTRY_SIZE_VERSION) r.skip(4); // entry size in bytes

  // artist, artist (unicode), title, title (unicode), creator, difficulty,
  // audio file name, md5 hash, .osu file name
  for (let i = 0; i < 9; i++) r.string();
  r.skip(1); // ranked status
  r.skip(6); // hitcircle / slider / spinner counts
  r.skip(8); // last modification time
  r.skip(version < FLOAT_DIFFICULTY_VERSION ? 4 : 16); // AR, CS, HP, OD
  r.skip(8); // slider velocity

  if (version >= FLOAT_DIFFICULTY_VERSION) {
    for (let i = 0; i < 4; i++) r.typedPairList(); // star ratings: osu!, taiko, catch, mania
  }

  r.skip(12); // drain time, total time, preview time
  const timingPoints = r.int();
  if (timingPoints < 0 || timingPoints > MAX_LIST_ENTRIES) {
    throw new Error(`implausible timing point count ${timingPoints} at offset ${r.offset - 4}`);
  }
  r.skip(timingPoints * 17); // double, double, bool

  r.skip(4); // beatmap id
  const beatmapsetId = r.int();
  r.skip(4); // thread id
  r.skip(4); // grade in each of the four modes
  r.skip(2); // local offset
  r.skip(4); // stack leniency
  r.skip(1); // gameplay mode
  r.string(); // source
  r.string(); // tags
  r.skip(2); // online offset
  r.string(); // title font
  r.skip(1); // unplayed
  r.skip(8); // last played
  r.skip(1); // is osz2
  r.string(); // folder name, relative to Songs
  r.skip(8); // last checked against the osu! repository
  r.skip(5); // ignore sound, ignore skin, disable storyboard, disable video, visual override
  if (version < FLOAT_DIFFICULTY_VERSION) r.skip(2); // unknown short
  r.skip(4); // last modification time
  r.skip(1); // mania scroll speed

  return beatmapsetId;
}

export interface OsuDbScan {
  /** Distinct beatmapset ids, unsubmitted maps (id <= 0) excluded. */
  setIds: number[];
  /** Difficulties listed in the file, i.e. the entry count osu! itself wrote. */
  beatmapCount: number;
  version: number;
}

/**
 * Returns null (never throws) if the file is missing or doesn't parse, so the
 * caller can fall back to scanning folder names.
 */
export async function readOsuDb(osuDbPath: string): Promise<OsuDbScan | null> {
  let buf: Buffer;
  try {
    buf = await fs.readFile(osuDbPath);
  } catch {
    return null;
  }

  try {
    const r = new Reader(buf);
    const version = r.int();
    if (version < MIN_VERSION || version > MAX_VERSION) {
      throw new Error(`unexpected osu!.db version ${version}`);
    }
    r.skip(4); // folder count
    r.skip(1); // account unlocked
    r.skip(8); // date the account will be unlocked
    r.string(); // player name

    const beatmapCount = r.int();
    if (beatmapCount < 0 || beatmapCount > MAX_BEATMAPS) {
      throw new Error(`implausible beatmap count ${beatmapCount}`);
    }

    const setIds = new Set<number>();
    for (let i = 0; i < beatmapCount; i++) {
      const setId = readBeatmapEntry(r, version);
      // Unsubmitted maps are stored as -1 (older builds use 0).
      if (setId > 0) setIds.add(setId);
    }

    // Only the trailing user-permissions int should be left. Anything more
    // means a field was misread somewhere and every id after that point is
    // garbage, which is worse than having none -- osu! writes this file, so a
    // short read is a bug in this parser, not a corrupt install.
    if (r.remaining > TRAILING_SLACK) {
      throw new Error(
        `${r.remaining} bytes left after ${beatmapCount} entries, parse desynced`
      );
    }

    return { setIds: [...setIds], beatmapCount, version };
  } catch (e) {
    console.warn(`[osu!.db] falling back to folder names: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
