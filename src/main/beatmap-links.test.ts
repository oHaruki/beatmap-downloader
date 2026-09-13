import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBeatmapLinks } from "../shared/beatmap-links.ts";

describe("beatmap link parsing", () => {
  it("understands set, difficulty and legacy link shapes", () => {
    const { refs, unrecognized } = parseBeatmapLinks([
      "https://osu.ppy.sh/beatmapsets/39804#osu/129891",
      "https://osu.ppy.sh/beatmapsets/1/discussion",
      "osu.ppy.sh/s/2",
      "https://osu.ppy.sh/d/3n",
      "https://osu.ppy.sh/b/129891",
      "https://osu.ppy.sh/beatmaps/75?mode=osu",
      "https://old.ppy.sh/p/beatmap?b=76&m=0",
      "https://osu.ppy.sh/p/beatmap?s=4",
      "http://OSU.PPY.SH/beatmapsets/5",
    ].join("\n"), "set");

    assert.deepEqual(refs, [
      { kind: "set", id: 39804 },
      { kind: "set", id: 1 },
      { kind: "set", id: 2 },
      { kind: "set", id: 3 },
      { kind: "beatmap", id: 129891 },
      { kind: "beatmap", id: 75 },
      { kind: "beatmap", id: 76 },
      { kind: "set", id: 4 },
      { kind: "set", id: 5 },
    ]);
    assert.deepEqual(unrecognized, []);
  });

  it("finds several links per line and drops duplicates", () => {
    const { refs } = parseBeatmapLinks(
      "https://osu.ppy.sh/beatmapsets/10 https://osu.ppy.sh/beatmapsets/11,https://osu.ppy.sh/beatmapsets/10\r\n" +
      "[NM1](https://osu.ppy.sh/b/20) and <https://osu.ppy.sh/b/20>",
      "set",
    );
    assert.deepEqual(refs, [
      { kind: "set", id: 10 },
      { kind: "set", id: 11 },
      { kind: "beatmap", id: 20 },
    ]);
  });

  it("reads bare IDs as whichever kind the user picked, links stay as they are", () => {
    const text = "129891\nhttps://osu.ppy.sh/s/39804\nhttps://osu.ppy.sh/b/75\n129891";
    assert.deepEqual(parseBeatmapLinks(text, "beatmap").refs, [
      { kind: "beatmap", id: 129891 },
      { kind: "set", id: 39804 },
      { kind: "beatmap", id: 75 },
    ]);
    assert.deepEqual(parseBeatmapLinks(text, "set").refs, [
      { kind: "set", id: 129891 },
      { kind: "set", id: 39804 },
      { kind: "beatmap", id: 75 },
    ]);
  });

  it("takes bare IDs only when they fill the whole line", () => {
    const { refs, unrecognized } = parseBeatmapLinks(
      "  123  \n\nNM1\thttps://osu.ppy.sh/b/456\t180\t5.67\nDT2 240 7.1\n0\nhttps://example.com/beatmapsets/9\nhttps://osu.ppy.sh/beatmapsets",
      "set",
    );
    assert.deepEqual(refs, [
      { kind: "set", id: 123 },
      { kind: "beatmap", id: 456 },
    ]);
    assert.deepEqual(unrecognized, ["DT2 240 7.1", "0", "https://example.com/beatmapsets/9", "https://osu.ppy.sh/beatmapsets"]);
  });
});
