import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { downloadFromMirrorToFile } from "./mirror.ts";

const archive = Buffer.from("UEsDBBQAAAAIAI82LF0W8Tk2FgAAABQAAAAHAAAAbWFwLm9zdcsvLlVIy8xJVUjLL8pNLFEoMzThAgBQSwECFAAUAAAACACPNixdFvE5NhYAAAAUAAAABwAAAAAAAAAAAAAAgAEAAAAAbWFwLm9zdVBLBQYAAAAAAQABADUAAAA7AAAAAAA=", "base64");

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
      assert.deepEqual(await fs.readFile(destination), archive);
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
              : new Response(archive);
          },
        },
      );

      assert.equal(result.mirror, "good.test");
      assert.equal(requested.length, 2);
      assert.deepEqual(await fs.readFile(destination), archive);
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

 it("rejects fake, truncated and corrupt archives without leaving files", () =>
   withDestination(async (destination) => {
     const corrupt = Buffer.from(archive);
     corrupt[40] ^= 0xff;
     for (const [index, bytes] of [Buffer.from("PK"), archive.subarray(0, 45), corrupt].entries()) {
       await assert.rejects(downloadFromMirrorToFile(1, destination, {}, {
         mirrors: [`https://invalid-${index}.test/{id}`], fetch: async () => new Response(bytes),
       }));
       await assert.rejects(fs.stat(destination), { code: "ENOENT" });
     }
   }));

 it("waits for rate limits, recovers, and bounds repeated failures", () =>
   withDestination(async (destination) => {
     let now = 0;
     let calls = 0;
     const waits: number[] = [];
     const deps = {
       mirrors: ["https://limited.test/{id}"], now: () => now,
       wait: async (ms: number) => { waits.push(ms); now += ms; },
       fetch: async () => ++calls === 1
         ? new Response("limited", { status: 429, headers: { "retry-after": "2" } })
         : new Response(archive),
     };
     await downloadFromMirrorToFile(1, destination, {}, deps);
     assert.equal(calls, 2);
     assert.deepEqual(waits, [2000]);
     calls = 0;
     await assert.rejects(downloadFromMirrorToFile(2, destination, {}, {
       ...deps, mirrors: ["https://always-limited.test/{id}"],
       fetch: async () => { calls++; return new Response("limited", { status: 429 }); },
     }), /429/);
     assert.equal(calls, 4);
   }));

 it("cancels a cooldown wait without another request", () =>
   withDestination(async (destination) => {
     const controller = new AbortController();
     let calls = 0;
     const promise = downloadFromMirrorToFile(1, destination, { signal: controller.signal }, {
       mirrors: ["https://cancel-wait.test/{id}"],
       fetch: async () => {
         calls++;
         setTimeout(() => controller.abort(), 20);
         return new Response("limited", { status: 429, headers: { "retry-after": "60" } });
       },
     });
     await assert.rejects(promise, { name: "AbortError" });
     assert.equal(calls, 1);
     await assert.rejects(fs.stat(destination), { code: "ENOENT" });
   }));

});
