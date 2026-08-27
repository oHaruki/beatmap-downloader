// Flat JSON "already downloaded" tracker, kept next to the output folder.
import { promises as fs } from "fs";
import path from "path";

interface ManifestEntry {
  downloadedAt: string;
  path: string;
}

type Manifest = Record<string, ManifestEntry>;

// Download workers can finish at the same time. Keep manifest updates for a
// given output folder in order so two read-modify-write cycles cannot overwrite
// each other. Separate output folders remain independent.
const pendingWrites = new Map<string, Promise<void>>();

function manifestPath(outDir: string): string {
  return path.join(outDir, ".beatmap-downloader-manifest.json");
}

export async function loadManifest(outDir: string): Promise<Manifest> {
  try {
    const raw = await fs.readFile(manifestPath(outDir), "utf-8");
    return JSON.parse(raw) as Manifest;
  } catch {
    return {};
  }
}

export async function recordDownload(outDir: string, beatmapsetId: number, filePath: string): Promise<void> {
  const target = manifestPath(outDir);
  const previous = pendingWrites.get(target) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const manifest = await loadManifest(outDir);
    manifest[String(beatmapsetId)] = { downloadedAt: new Date().toISOString(), path: filePath };
    await fs.writeFile(target, JSON.stringify(manifest, null, 2), "utf-8");
  });

  pendingWrites.set(target, current);
  try {
    await current;
  } finally {
    // Do not remove a newer write that was queued while this one was running.
    if (pendingWrites.get(target) === current) pendingWrites.delete(target);
  }
}

export async function listDownloadedIds(outDir: string): Promise<number[]> {
  const manifest = await loadManifest(outDir);
  return Object.keys(manifest)
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0)
    .sort((left, right) => left - right);
}
