import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeExternalUrl } from "./external-url.ts";

describe("safeExternalUrl", () => {
  it("allows valid HTTPS links", () => {
    assert.equal(
      safeExternalUrl("https://osu.ppy.sh/home/account/edit"),
      "https://osu.ppy.sh/home/account/edit",
    );
  });

  it("rejects invalid and non-HTTPS links", () => {
    assert.equal(safeExternalUrl("http://osu.ppy.sh"), null);
    assert.equal(safeExternalUrl("file:///C:/Windows/System32/cmd.exe"), null);
    assert.equal(safeExternalUrl("not a URL"), null);
  });
});
