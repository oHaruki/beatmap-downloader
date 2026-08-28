import { promises as fs } from "fs";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { listDownloadedIds, recordDownload } from "./manifest.ts";

describe("recordDownload", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("preserves every entry when downloads finish concurrently", async () => {
    let storedManifest = "{}";

    mock.method(fs, "readFile", async () => storedManifest);
    mock.method(fs, "writeFile", async (_path: unknown, data: unknown) => {
      storedManifest = String(data);
    });

    await Promise.all([
      recordDownload("C:\\downloads", 101, "C:\\downloads\\101 First.osz"),
      recordDownload("C:\\downloads", 202, "C:\\downloads\\202 Second.osz"),
    ]);

    const manifest = JSON.parse(storedManifest) as Record<string, { path: string }>;
    assert.equal(manifest["101"]?.path, "C:\\downloads\\101 First.osz");
    assert.equal(manifest["202"]?.path, "C:\\downloads\\202 Second.osz");
  });

  it("returns only sorted positive safe integer ids", async () => {
    mock.method(fs, "readFile", async () => JSON.stringify({
      "456": {},
      "abc": {},
      "-5": {},
      "0": {},
      "9007199254740992": {},
      "123": {},
    }));

    assert.deepEqual(await listDownloadedIds("C:\\downloads"), [123, 456]);
  });
});
