import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { listDownloadedIds, recordDownload } from "./manifest.ts";

async function withTempDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "beatmap-manifest-"));
  try {
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

describe("download manifest", () => {
  it("preserves every entry when downloads finish concurrently", () =>
    withTempDirectory(async (directory) => {
      await Promise.all([
        recordDownload(directory, 101, path.join(directory, "101 First.osz")),
        recordDownload(directory, 202, path.join(directory, "202 Second.osz")),
      ]);

      const manifest = JSON.parse(
        await fs.readFile(path.join(directory, ".beatmap-downloader-manifest.json"), "utf8"),
      ) as Record<string, { path: string }>;
      assert.equal(manifest["101"]?.path, path.join(directory, "101 First.osz"));
      assert.equal(manifest["202"]?.path, path.join(directory, "202 Second.osz"));
      assert.deepEqual(
        (await fs.readdir(directory)).filter((name) => name.endsWith(".tmp")),
        [],
      );
    }));

  it("returns only sorted ids with valid manifest entries", () =>
    withTempDirectory(async (directory) => {
      await fs.writeFile(
        path.join(directory, ".beatmap-downloader-manifest.json"),
        JSON.stringify({
          "456": { downloadedAt: "2026-01-01T00:00:00.000Z", path: "456.osz" },
          abc: { downloadedAt: "2026-01-01T00:00:00.000Z", path: "abc.osz" },
          "-5": { downloadedAt: "2026-01-01T00:00:00.000Z", path: "-5.osz" },
          "123": { downloadedAt: "2026-01-01T00:00:00.000Z", path: "123.osz" },
          "789": {},
        }),
      );

      assert.deepEqual(await listDownloadedIds(directory), [123, 456]);
    }));
});
