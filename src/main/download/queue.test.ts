import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import type { DownloadProgressEvent } from "@shared/types";
import { runDownloadQueue, safeFileName } from "./queue.ts";

describe("download queue", () => {
  it("deduplicates jobs and atomically completes the destination", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "beatmap-queue-"));
    const events: DownloadProgressEvent[] = [];
    let downloads = 0;
    try {
      await runDownloadQueue(
        {
          jobs: [
            { beatmapsetId: 123, fileName: "Artist - Title" },
            { beatmapsetId: 123, fileName: "Duplicate" },
          ],
          outDir: directory,
          force: false,
          installedIds: [],
          onProgress: (event) => events.push(event),
        },
        {
          download: async (_id, destination, options) => {
            downloads += 1;
            await fs.writeFile(destination, "PK archive");
            options.onProgress?.(10, 10);
            return { mirror: "mirror.test" };
          },
        },
      );

      assert.equal(downloads, 1);
      assert.equal(events.at(-1)?.status, "done");
      assert.equal(events.at(-1)?.mirror, "mirror.test");
      assert.equal(await fs.readFile(path.join(directory, "123 Artist - Title.osz"), "utf8"), "PK archive");
      await assert.rejects(fs.stat(path.join(directory, "123 Artist - Title.osz.part")), {
        code: "ENOENT",
      });
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it("marks queued jobs as cancelled without starting them", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "beatmap-queue-cancel-"));
    const controller = new AbortController();
    const events: DownloadProgressEvent[] = [];
    controller.abort();
    try {
      await runDownloadQueue({
        jobs: [{ beatmapsetId: 456, fileName: "Cancelled" }],
        outDir: directory,
        force: false,
        installedIds: [],
        signal: controller.signal,
        onProgress: (event) => events.push(event),
      });
      assert.deepEqual(events.map((event) => event.status), ["queued", "cancelled"]);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it("removes Windows-invalid file-name characters", () => {
    assert.equal(safeFileName('Artist: Song?*.'), "Artist_ Song__");
  });
});
