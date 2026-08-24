// Reads installed beatmapset ids from an osu!(stable) Songs folder (each
// set's folder starts with its id). Not supported for lazer.
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const ID_PREFIX = /^(\d+)\s/;

export async function findDefaultSongsFolder(): Promise<string | null> {
  const candidates = [
    process.env["LOCALAPPDATA"] ? path.join(process.env["LOCALAPPDATA"], "osu!", "Songs") : null,
    path.join(os.homedir(), "AppData", "Local", "osu!", "Songs"),
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export async function listInstalledBeatmapsetIds(songsFolder: string): Promise<number[]> {
  try {
    const entries = await fs.readdir(songsFolder, { withFileTypes: true });
    const ids: number[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const match = ID_PREFIX.exec(entry.name);
      if (match) ids.push(Number(match[1]));
    }
    return ids;
  } catch {
    return [];
  }
}
