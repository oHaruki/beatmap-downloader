// Works out which beatmapsets are installed for osu!(stable), from two
// independent sources that are unioned because neither is complete alone:
//
//   osu!.db      the game's own index. Carries the real BeatmapSetID no
//                matter what the folder is called, but osu! only rewrites it
//                on exit, so it lags anything imported in this session.
//   Songs folder entries named "<id> Artist - Title", bare "<id>", or a
//                loose "<id>.osz". Sees fresh imports immediately, but is
//                blind to folders renamed by hand or predating the id
//                convention.
//
// Neither covers lazer, which stores beatmaps content-addressed under a
// realm index rather than as named folders.
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { InstalledSongsScan } from "@shared/types";
import { readOsuDb } from "./osu-db";

// "12345 Artist - Title", "12345", "12345.osz", "12345 - Title". The id must
// be the whole name or followed by a separator (space/dot); "1234artist"
// (a title that merely starts with digits) must NOT match.
const ID_PREFIX = /^(\d+)(?=$|[\s.])/;
const OSZ_SUFFIX = /\.osz$/i;

function localAppDataDir(): string {
  return process.env["LOCALAPPDATA"] ?? path.join(os.homedir(), "AppData", "Local");
}

export function parseStableDirectoryName(name: string): number | null {
  const match = ID_PREFIX.exec(name.trim());
  if (!match) return null;

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function readBeatmapDirectoryOverride(installRoot: string): Promise<string | null> {
  let entries;
  try {
    entries = await fs.readdir(installRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  // osu! keeps per-username configs; prefer the most recently written one.
  const configFiles = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^osu!\..+\.cfg$/i.test(entry.name)) continue;
    const configPath = path.join(installRoot, entry.name);
    try {
      const { mtimeMs } = await fs.stat(configPath);
      configFiles.push({ configPath, mtimeMs });
    } catch {
      // unreadable config: skip it
    }
  }
  configFiles.sort((left, right) => right.mtimeMs - left.mtimeMs);

  for (const { configPath } of configFiles) {
    let raw;
    try {
      raw = await fs.readFile(configPath);
    } catch {
      continue;
    }
    // osu! writes these files as UTF-16LE (with BOM) or UTF-8.
    const looksUtf16 =
      (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) || raw.includes(0);
    const contents = raw.toString(looksUtf16 ? "utf16le" : "utf8").replace(/^\uFEFF/, "");
    const line = contents.split(/\r?\n/).find((candidate) => /^\s*BeatmapDirectory\s*=/i.test(candidate));
    if (!line) continue;

    const value = line.slice(line.indexOf("=") + 1).trim();
    // Empty or "Songs" means the default location inside the install root.
    if (!value || /^songs?$/i.test(value)) return null;
    return path.isAbsolute(value) ? value : path.join(installRoot, value);
  }
  return null;
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

export async function findDefaultSongsFolder(): Promise<string | null> {
  const installRoot = path.join(localAppDataDir(), "osu!");
  const defaultSongs = path.join(installRoot, "Songs");

  // A custom BeatmapDirectory wins over the default Songs folder, but only
  // if it actually exists on disk.
  const override = await readBeatmapDirectoryOverride(installRoot);
  if (override && (await isDirectory(override))) return override;

  return (await isDirectory(defaultSongs)) ? defaultSongs : null;
}

// osu!.db lives in the install root, which is NOT reliably the parent of the
// Songs folder: BeatmapDirectory can point at another drive entirely. Probe
// the parent (the default layout, and what picking "<install>\Songs" in the
// folder dialog gives) before the default install location.
async function findOsuDb(songsFolder: string): Promise<string | null> {
  const candidates = [
    path.join(songsFolder, "..", "osu!.db"),
    path.join(localAppDataDir(), "osu!", "osu!.db"),
  ];
  for (const candidate of candidates) {
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

async function listIdsFromSongsFolder(songsFolder: string): Promise<number[]> {
  try {
    const entries = await fs.readdir(songsFolder, { withFileTypes: true });
    const ids = new Set<number>();
    for (const entry of entries) {
      // Loose .osz archives count as installed too, not just extracted folders.
      const isOsz = entry.isFile() && OSZ_SUFFIX.test(entry.name);
      if (!entry.isDirectory() && !isOsz) continue;

      const id = parseStableDirectoryName(entry.name);
      if (id !== null) ids.add(id);
    }
    return [...ids];
  } catch {
    // Missing/unreadable Songs folder counts as nothing installed; the UI
    // lets the user point at the right folder manually.
    return [];
  }
}

export async function listInstalledBeatmapsets(songsFolder: string): Promise<InstalledSongsScan> {
  const osuDbPath = await findOsuDb(songsFolder);
  const [osuDb, folderIds] = await Promise.all([
    osuDbPath ? readOsuDb(osuDbPath) : Promise.resolve(null),
    listIdsFromSongsFolder(songsFolder),
  ]);

  const ids = new Set<number>(folderIds);
  for (const id of osuDb?.setIds ?? []) ids.add(id);

  const source = osuDb
    ? osuDb.setIds.length >= ids.size
      ? "osu!.db"
      : "osu!.db + folder names"
    : "folder names";

  return {
    ids: [...ids].sort((left, right) => left - right),
    source,
    fromOsuDb: osuDb?.setIds.length ?? 0,
    fromFolderNames: new Set(folderIds).size,
  };
}
