// Flat JSON "already downloaded" tracker, kept next to the output folder.
import { promises as fs } from "node:fs";
import path from "node:path";
import { displayPath, isMissingFile, isRecord, writeJsonAtomic } from "../json-file";

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

export function parseManifest(value: unknown): Manifest {
  if (!isRecord(value)) return {};
  const manifest: Manifest = {};
  for (const [id, entry] of Object.entries(value)) {
    const numericId = Number(id);
    if (
      !Number.isSafeInteger(numericId) ||
      numericId <= 0 ||
      !isRecord(entry) ||
      typeof entry["downloadedAt"] !== "string" ||
      typeof entry["path"] !== "string"
    ) {
      continue;
    }
    manifest[id] = { downloadedAt: entry["downloadedAt"], path: entry["path"] };
  }
  return manifest;
}

export async function loadManifest(outDir: string): Promise<Manifest> {
  const filePath = manifestPath(outDir);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return parseManifest(JSON.parse(raw));
  } catch (error) {
    if (!isMissingFile(error)) {
      console.warn(`[manifest] could not read ${displayPath(filePath)}; rebuilding it`);
    }
    return {};
  }
}

export async function recordDownload(outDir: string, beatmapsetId: number, filePath: string): Promise<void> {
  const target = manifestPath(outDir);
  const previous = pendingWrites.get(target) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const manifest = await loadManifest(outDir);
    manifest[String(beatmapsetId)] = { downloadedAt: new Date().toISOString(), path: filePath };
    await writeJsonAtomic(target, manifest);
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
