// Reads installed beatmapset ids from an osu!(stable) Songs folder. Each
// set's folder (or loose .osz file) starts with its beatmapset id; very old
// downloads predate that convention, so their names are also reported for
// title-based matching in the renderer.
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { normalizeBeatmapsetName } from "@shared/name-key";

// "12345 Artist - Title", "12345", "12345.osz", "12345 - Title". The id must
// be the whole name or followed by a separator (space/dot); "1234artist"
// (a title that merely starts with digits) must NOT match.
const ID_PREFIX = /^(\d+)(?=$|[\s.])/;
const OSZ_SUFFIX = /\.osz$/i;

export interface InstalledSongsScan {
  ids: number[];
  /**
   * Normalized names of Songs entries with no usable id prefix (legacy,
   * pre-2013 downloads named "Artist - Title"). The renderer matches these
   * against search results so old maps are still recognized as owned.
   */
  legacyNames: string[];
}

export const normalizeSongEntryName = normalizeBeatmapsetName;

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
  const localAppData = process.env["LOCALAPPDATA"] ?? path.join(os.homedir(), "AppData", "Local");
  const installRoot = path.join(localAppData, "osu!");
  const defaultSongs = path.join(installRoot, "Songs");

  // A custom BeatmapDirectory wins over the default Songs folder, but only
  // if it actually exists on disk.
  const override = await readBeatmapDirectoryOverride(installRoot);
  if (override && (await isDirectory(override))) return override;

  const candidates = [defaultSongs];
  for (const candidate of candidates) {
    if (await isDirectory(candidate)) return candidate;
  }
  return null;
}

export async function listInstalledBeatmapsets(songsFolder: string): Promise<InstalledSongsScan> {
  try {
    const entries = await fs.readdir(songsFolder, { withFileTypes: true });
    const ids = new Set<number>();
    const legacyNames: string[] = [];

    for (const entry of entries) {
      const isDir = entry.isDirectory();
      // Loose .osz archives count as installed too, not just extracted folders.
      const isOsz = entry.isFile() && OSZ_SUFFIX.test(entry.name);
      if (!isDir && !isOsz) continue;

      const id = parseStableDirectoryName(entry.name);
      if (id !== null) {
        ids.add(id);
        continue;
      }
      const bare = isOsz ? entry.name.replace(OSZ_SUFFIX, "") : entry.name;
      const normalized = normalizeSongEntryName(bare);
      if (normalized) legacyNames.push(normalized);
    }

    return { ids: [...ids].sort((left, right) => left - right), legacyNames };
  } catch {
    // Missing/unreadable Songs folder counts as nothing installed; the UI
    // lets the user point at the right folder manually.
    return { ids: [], legacyNames: [] };
  }
}
