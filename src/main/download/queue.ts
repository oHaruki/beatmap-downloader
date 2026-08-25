import { promises as fs } from "fs";
import path from "path";
import type { DownloadJob, DownloadProgressEvent } from "@shared/types";
import { downloadFromMirror } from "./mirror";
import { loadManifest, recordDownload } from "./manifest";

const CONCURRENCY = 3;
const STAGGER_MS = 250; // spreads out request starts instead of firing in bursts
const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

function safeFileName(name: string): string {
  const cleaned = name.replace(INVALID_CHARS, "_").trim().replace(/\.+$/, "");
  return (cleaned || "beatmapset").slice(0, 150);
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  // Each slot's first request is staggered from the others (0ms, 250ms,
  // 500ms, ...); after that, real download latency keeps them naturally
  // spread out, so no per-item delay is needed within a slot.
  async function runSlot(slot: number): Promise<void> {
    if (slot > 0) await new Promise((r) => setTimeout(r, slot * STAGGER_MS));
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }
  const slots = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: slots }, (_, slot) => runSlot(slot)));
}

// Skips ids already in the manifest or Songs folder unless force is true.
// This is a backstop; the renderer filters these out before calling in.
// When onImported is provided (auto-import enabled), each completed download
// is handed to it so the file can be copied/launched into osu!.
export async function runDownloadQueue(
  jobs: DownloadJob[],
  outDir: string,
  force: boolean,
  installedIds: number[],
  onProgress: (event: DownloadProgressEvent) => void,
  onImported?: (filePath: string, beatmapsetId: number) => Promise<string | undefined>
): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });
  const manifest = await loadManifest(outDir);
  const installed = new Set(installedIds);

  await runPool(jobs, CONCURRENCY, async (job) => {
    if (!force && installed.has(job.beatmapsetId)) {
      onProgress({ beatmapsetId: job.beatmapsetId, status: "skipped", message: "already installed" });
      return;
    }
    if (!force && manifest[String(job.beatmapsetId)]) {
      onProgress({ beatmapsetId: job.beatmapsetId, status: "skipped", message: "already downloaded" });
      return;
    }

    onProgress({ beatmapsetId: job.beatmapsetId, status: "downloading", progressPercent: null });
    try {
      let lastReportedStep = -1;
      const { data } = await downloadFromMirror(job.beatmapsetId, (received, total) => {
        if (!total) return; // unknown size, stay indeterminate rather than fake a percent
        const step = Math.floor((received / total) * 20); // report every ~5%
        if (step === lastReportedStep) return;
        lastReportedStep = step;
        onProgress({
          beatmapsetId: job.beatmapsetId,
          status: "downloading",
          progressPercent: Math.min(100, Math.round((received / total) * 100)),
        });
      });
      // Prefix with the beatmapset id (osu!stable's own naming convention)
      // so these files are recognized as installed by any future Songs scan.
      const fileName = `${job.beatmapsetId} ${safeFileName(job.fileName)}.osz`;
      const dest = path.join(outDir, fileName);
      await fs.writeFile(dest, data);
      await recordDownload(outDir, job.beatmapsetId, dest);
      let importMessage: string | undefined;
      if (onImported) {
        try {
          // Wait for the copy/launch attempt before reporting the item done;
          // otherwise the app could finish the batch while imports still run.
          importMessage = await onImported(dest, job.beatmapsetId);
        } catch (e) {
          // Import problems never fail the download itself; report as a note.
          importMessage = e instanceof Error ? e.message : "Import failed";
        }
      }
      onProgress({
        beatmapsetId: job.beatmapsetId,
        status: "done",
        ...(importMessage ? { message: importMessage } : {}),
      });
    } catch (e) {
      onProgress({
        beatmapsetId: job.beatmapsetId,
        status: "error",
        message: e instanceof Error ? e.message : "Download failed",
      });
    }
  });
}
