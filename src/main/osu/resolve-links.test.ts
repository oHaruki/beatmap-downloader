import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BeatmapLookup, BeatmapsetName } from "./api.ts";
import { resolveBeatmapLinks } from "./resolve-links.ts";

const name = (title: string): BeatmapsetName => ({ artist: "Artist", title, creator: "Mapper" });

describe("resolveBeatmapLinks", () => {
  it("maps difficulties to sets, keeps paste order and merges duplicates", async () => {
    const nameLookups: number[] = [];
    const result = await resolveBeatmapLinks(
      [
        { kind: "beatmap", id: 900 },
        { kind: "set", id: 2 },
        { kind: "beatmap", id: 901 },
        { kind: "beatmap", id: 404 },
        { kind: "set", id: 1 },
      ],
      {
        lookupBeatmaps: async (ids) => {
          assert.deepEqual(ids, [900, 901, 404]);
          return new Map<number, BeatmapLookup>([
            [900, { beatmapsetId: 1, name: name("From difficulty") }],
            [901, { beatmapsetId: 2, name: null }],
          ]);
        },
        lookupBeatmapsetName: async (id) => {
          nameLookups.push(id);
          return id === 2 ? name("From set") : null;
        },
      },
    );

    assert.deepEqual(result.jobs, [
      { beatmapsetId: 1, fileName: "Artist - From difficulty (Mapper)" },
      { beatmapsetId: 2, fileName: "Artist - From set (Mapper)" },
    ]);
    assert.deepEqual(nameLookups, [2], "names already known from a difficulty are not fetched again");
    assert.deepEqual(result.problems, ["Difficulty 404 was not found on osu!."]);
  });

  it("splits difficulty lookups into API sized chunks", async () => {
    const chunks: number[] = [];
    const refs = Array.from({ length: 120 }, (_, index) => ({ kind: "beatmap" as const, id: index + 1 }));
    const result = await resolveBeatmapLinks(refs, {
      lookupBeatmaps: async (ids) => {
        chunks.push(ids.length);
        return new Map(ids.map((id) => [id, { beatmapsetId: id, name: name(String(id)) }]));
      },
      lookupBeatmapsetName: async () => assert.fail("no name lookups expected"),
    });
    assert.deepEqual(chunks, [50, 50, 20]);
    assert.equal(result.jobs.length, 120);
  });

  it("still queues set links when the API is unavailable", async () => {
    const result = await resolveBeatmapLinks(
      [{ kind: "set", id: 7 }, { kind: "beatmap", id: 8 }, { kind: "set", id: 9 }],
      {
        lookupBeatmaps: async () => { throw new Error("credentials are not configured"); },
        lookupBeatmapsetName: async () => { throw new Error("credentials are not configured"); },
      },
    );
    assert.deepEqual(result.jobs, [
      { beatmapsetId: 7, fileName: "beatmapset 7" },
      { beatmapsetId: 9, fileName: "beatmapset 9" },
    ]);
    assert.deepEqual(result.problems, [
      "Could not look up difficulty links: credentials are not configured",
      "Some maps will be saved without their title: credentials are not configured",
    ]);
  });

  it("rethrows once the lookup is cancelled", async () => {
    const controller = new AbortController();
    await assert.rejects(
      resolveBeatmapLinks([{ kind: "set", id: 1 }], {
        lookupBeatmaps: async () => new Map(),
        lookupBeatmapsetName: async () => {
          controller.abort();
          const error = new Error("aborted");
          error.name = "AbortError";
          throw error;
        },
      }, controller.signal),
      { name: "AbortError" },
    );
  });
});
