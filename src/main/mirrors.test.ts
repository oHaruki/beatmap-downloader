import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enabledMirrorTemplates, MIRRORS, parseDisabledMirrors } from "../shared/mirrors.ts";

describe("mirror settings", () => {
  it("enables every mirror by default, in cascade order", () => {
    assert.deepEqual(parseDisabledMirrors(undefined), []);
    assert.deepEqual(enabledMirrorTemplates([]), MIRRORS.map((mirror) => mirror.template));
  });

  it("drops unknown and duplicate ids and keeps the cascade order", () => {
    assert.deepEqual(parseDisabledMirrors(["nekoha", "gone.example", "catboy", "nekoha", 3]), ["catboy", "nekoha"]);
    assert.deepEqual(enabledMirrorTemplates(["catboy", "nekoha"]), [
      "https://api.nerinyan.moe/d/{id}",
      "https://osu.direct/api/d/{id}",
      "https://beatconnect.io/b/{id}",
    ]);
  });

  it("never leaves a batch without any mirror", () => {
    assert.deepEqual(parseDisabledMirrors(MIRRORS.map((mirror) => mirror.id)), []);
  });
});
