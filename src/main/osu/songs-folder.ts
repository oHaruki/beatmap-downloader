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
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { InstalledSongsScan, OsuFolderSelection } from "@shared/types";
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

async function isFile(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isFile();
  } catch {
    return false;
  }
}

export async function resolveOsuFolder(selectedFolder: string): Promise<OsuFolderSelection> {
  const selected = path.resolve(selectedFolder);
  const installRoot =
    path.basename(selected).toLowerCase() === "songs" ? path.dirname(selected) : selected;
  if (!(await isFile(path.join(installRoot, "osu!.exe")))) {
    throw new Error("Choose the osu! folder that contains osu!.exe.");
  }

  const override = await readBeatmapDirectoryOverride(installRoot);
  const songsFolder =
    override && (await isDirectory(override)) ? override : path.join(installRoot, "Songs");
  if (!(await isDirectory(songsFolder))) {
    throw new Error("The selected osu! folder does not contain its configured Songs folder.");
  }

  return { osuFolder: installRoot, songsFolder };
}

export async function findDefaultOsuFolder(): Promise<OsuFolderSelection | null> {
  const candidates = [path.join(localAppDataDir(), "osu!")];
  if (process.platform === "win32") {
    try {
      const { stdout } = await promisify(execFile)("reg.exe", ["query", "HKCR\\osu\\shell\\open\\command", "/ve"], { windowsHide: true, timeout: 1500 });
      const executable = /REG_(?:EXPAND_)?SZ\s+"?(.+?\.exe)(?:"|\s|$)/i.exec(stdout)?.[1];
      if (executable) {
        const expanded = executable.replace(/%([^%]+)%/g, (_, name: string) => process.env[name] ?? `%${name}%`);
        candidates.unshift(path.dirname(expanded));
      }
    } catch { /* No registered osu! protocol; try common install locations. */ }
    // Start Menu/Desktop shortcuts still point at installs moved to another
    // drive. Lazer shortcuts resolve too but fail the Songs check below.
    // Loaded lazily so tests can import this module outside Electron.
    const { app, shell } = await import("electron");
    const shortcutDirs = [
      path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs"),
      path.join(process.env.ProgramData ?? "C:\\ProgramData", "Microsoft", "Windows", "Start Menu", "Programs"),
      app.getPath("desktop"),
    ];
    for (const dir of shortcutDirs) {
      for (const name of await fs.readdir(dir).catch(() => [] as string[])) {
        if (!/^osu.*\.lnk$/i.test(name)) continue;
        try { candidates.push(path.dirname(shell.readShortcutLink(path.join(dir, name)).target)); }
        catch { /* Broken shortcut. */ }
      }
    }
    for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]) {
      if (base) candidates.push(path.join(base, "osu!"));
    }
    // ponytail: only probes X:\osu!, add a shallow drive scan if installs in deeper folders are missed.
    for (const letter of "CDEFGHIJKLMNOPQRSTUVWXYZ") candidates.push(`${letter}:\\osu!`);
  }
  for (const candidate of new Set(candidates)) {
    try { return await resolveOsuFolder(candidate); }
    catch { /* Try the next installation. */ }
  }
  return null;
}

// osu!.db lives in the install root, which is NOT reliably the parent of the
// Songs folder: BeatmapDirectory can point at another drive entirely. Probe
// the parent (the default layout, and what picking "<install>\Songs" in the
// folder dialog gives) before the default install location.
async function findOsuDb(songsFolder: string, osuFolder?: string): Promise<string | null> {
  const candidates = [
    ...(osuFolder ? [path.join(osuFolder, "osu!.db")] : []),
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

export async function listInstalledBeatmapsets(
  songsFolder: string,
  osuFolder?: string,
): Promise<InstalledSongsScan> {
  const osuDbPath = await findOsuDb(songsFolder, osuFolder);
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
