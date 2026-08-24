// Flat JSON "already downloaded" tracker, kept next to the output folder.
import { promises as fs } from "fs";
import path from "path";

interface ManifestEntry {
  downloadedAt: string;
  path: string;
}

type Manifest = Record<string, ManifestEntry>;

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
  const manifest = await loadManifest(outDir);
  manifest[String(beatmapsetId)] = { downloadedAt: new Date().toISOString(), path: filePath };
  await fs.writeFile(manifestPath(outDir), JSON.stringify(manifest, null, 2), "utf-8");
}

export async function listDownloadedIds(outDir: string): Promise<number[]> {
  const manifest = await loadManifest(outDir);
  return Object.keys(manifest).map(Number);
}
