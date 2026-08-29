import { promises as fs } from "node:fs";
import path from "node:path";
import type { DownloadJob, DownloadProgressEvent } from "@shared/types";
import { downloadFromMirrorToFile, type MirrorDownloadOptions } from "./mirror";
import { loadManifest, recordDownload } from "./manifest";

const CONCURRENCY = 3;
const STAGGER_MS = 250;
const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

export interface DownloadQueueOptions {
  jobs: DownloadJob[];
  outDir: string;
  force: boolean;
  installedIds: number[];
  signal?: AbortSignal;
  onProgress: (event: DownloadProgressEvent) => void;
  onImported?: (filePath: string, beatmapsetId: number) => Promise<string | undefined>;
}

export interface DownloadQueueDeps {
  download?: (
    beatmapsetId: number,
    destination: string,
    options: MirrorDownloadOptions,
  ) => Promise<{ mirror: string }>;
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(INVALID_CHARS, "_").trim().replace(/[ .]+$/, "");
  return (cleaned || "beatmapset").slice(0, 150);
}

function uniqueJobs(jobs: DownloadJob[]): DownloadJob[] {
  const seen = new Set<number>();
  return jobs.filter((job) => {
    if (seen.has(job.beatmapsetId)) return false;
    seen.add(job.beatmapsetId);
    return true;
  });
}

function isReplacementError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EEXIST" || error.code === "EPERM")
  );
}

async function replaceFile(temporaryPath: string, destination: string): Promise<void> {
  try {
    await fs.rename(temporaryPath, destination);
  } catch (error) {
    if (!isReplacementError(error)) throw error;
    await fs.rm(destination, { force: true });
    await fs.rename(temporaryPath, destination);
  }
}

async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function runSlot(slot: number): Promise<void> {
    if (slot > 0) await new Promise((resolve) => setTimeout(resolve, slot * STAGGER_MS));
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }
  const slots = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: slots }, (_, slot) => runSlot(slot)));
}

export async function runDownloadQueue(
  options: DownloadQueueOptions,
  deps: DownloadQueueDeps = {},
): Promise<void> {
  const jobs = uniqueJobs(options.jobs);
  const download = deps.download ?? downloadFromMirrorToFile;
  await fs.mkdir(options.outDir, { recursive: true });
  const manifest = await loadManifest(options.outDir);
  const downloaded = new Set(Object.keys(manifest).map(Number));
  const installed = new Set(options.installedIds);

  for (const job of jobs) {
    options.onProgress({ beatmapsetId: job.beatmapsetId, status: "queued" });
  }

  await runPool(jobs, CONCURRENCY, async (job) => {
    if (options.signal?.aborted) {
      options.onProgress({ beatmapsetId: job.beatmapsetId, status: "cancelled" });
      return;
    }
    if (!options.force && installed.has(job.beatmapsetId)) {
      options.onProgress({ beatmapsetId: job.beatmapsetId, status: "skipped", message: "already installed" });
      return;
    }
    if (!options.force && downloaded.has(job.beatmapsetId)) {
      options.onProgress({ beatmapsetId: job.beatmapsetId, status: "skipped", message: "already downloaded" });
      return;
    }

    const fileName = `${job.beatmapsetId} ${safeFileName(job.fileName)}.osz`;
    const destination = path.join(options.outDir, fileName);
    const temporaryPath = `${destination}.part`;
    options.onProgress({ beatmapsetId: job.beatmapsetId, status: "downloading", progressPercent: null });

    try {
      let lastReportedStep = -1;
      const result = await download(job.beatmapsetId, temporaryPath, {
        signal: options.signal,
        onProgress(received, total) {
          if (!total) return;
          const step = Math.floor((received / total) * 20);
          if (step === lastReportedStep) return;
          lastReportedStep = step;
          options.onProgress({
            beatmapsetId: job.beatmapsetId,
            status: "downloading",
            progressPercent: Math.min(100, Math.round((received / total) * 100)),
          });
        },
      });
      await replaceFile(temporaryPath, destination);
      await recordDownload(options.outDir, job.beatmapsetId, destination);
      downloaded.add(job.beatmapsetId);

      let importMessage: string | undefined;
      if (options.onImported) {
        try {
          importMessage = await options.onImported(destination, job.beatmapsetId);
        } catch (error) {
          importMessage = error instanceof Error ? error.message : "Import failed";
        }
      }
      options.onProgress({
        beatmapsetId: job.beatmapsetId,
        status: "done",
        mirror: result.mirror,
        ...(importMessage ? { message: importMessage } : {}),
      });
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
        options.onProgress({ beatmapsetId: job.beatmapsetId, status: "cancelled" });
        return;
      }
      options.onProgress({
        beatmapsetId: job.beatmapsetId,
        status: "error",
        message: error instanceof Error ? error.message : "Download failed",
      });
    }
  });
}
