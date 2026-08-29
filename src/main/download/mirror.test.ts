import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { downloadFromMirrorToFile } from "./mirror.ts";

async function withDestination(run: (destination: string) => Promise<void>): Promise<void> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "beatmap-mirror-"));
  try {
    await run(path.join(directory, "map.osz.part"));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

describe("downloadFromMirrorToFile", () => {
  it("streams a zip response to disk and reports progress", () =>
    withDestination(async (destination) => {
      const archive = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
      const progress: Array<[number, number | null]> = [];
      const result = await downloadFromMirrorToFile(
        123,
        destination,
        { onProgress: (received, total) => progress.push([received, total]) },
        {
          mirrors: ["https://mirror.test/{id}"],
          fetch: async () =>
            new Response(archive, { headers: { "content-length": String(archive.length) } }),
        },
      );

      assert.equal(result.mirror, "mirror.test");
      assert.deepEqual(new Uint8Array(await fs.readFile(destination)), archive);
      assert.deepEqual(progress.at(-1), [archive.length, archive.length]);
    }));

  it("falls back after an invalid response and removes failed partials", () =>
    withDestination(async (destination) => {
      const requested: string[] = [];
      const result = await downloadFromMirrorToFile(
        456,
        destination,
        {},
        {
          mirrors: ["https://bad.test/{id}", "https://good.test/{id}"],
          fetch: async (input) => {
            const url = String(input);
            requested.push(url);
            return url.includes("bad.test")
              ? new Response("rate limited")
              : new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
          },
        },
      );

      assert.equal(result.mirror, "good.test");
      assert.equal(requested.length, 2);
      assert.deepEqual(new Uint8Array(await fs.readFile(destination)), new Uint8Array([0x50, 0x4b, 3, 4]));
    }));

  it("does not create a file when already cancelled", () =>
    withDestination(async (destination) => {
      const controller = new AbortController();
      controller.abort();
      await assert.rejects(
        downloadFromMirrorToFile(
          789,
          destination,
          { signal: controller.signal },
          { mirrors: ["https://cancelled.test/{id}"], fetch: async () => new Response() },
        ),
        { name: "AbortError" },
      );
      await assert.rejects(fs.stat(destination), { code: "ENOENT" });
    }));
});
