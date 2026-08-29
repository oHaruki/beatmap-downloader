import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BeatmapsetSummary } from "../shared/types.ts";
import {
  applyResultsFilter,
  countByOwnership,
  retainVisibleSelections,
} from "../renderer/src/results-filter.ts";

const results = [1, 2, 3].map(
  (id): BeatmapsetSummary => ({
    id,
    title: `Title ${id}`,
    artist: "Artist",
    creator: "Mapper",
    status: "ranked",
    covers: {},
    beatmaps: [],
  }),
);

describe("results ownership filters", () => {
  it("counts installed, downloaded, and missing results without overlap", () => {
    assert.deepEqual(countByOwnership(results, new Set([1]), new Set([1, 2])), {
      installed: 1,
      downloaded: 1,
      missing: 1,
    });
  });

  it("keeps missing results first or exclusively", () => {
    assert.deepEqual(
      applyResultsFilter(results, "missing-first", new Set([1]), new Set([2])).map((set) => set.id),
      [3, 1, 2],
    );
    assert.deepEqual(
      applyResultsFilter(results, "missing-only", new Set([1]), new Set([2])).map((set) => set.id),
      [3],
    );
  });

  it("drops selections that are no longer visible", () => {
    assert.deepEqual([...retainVisibleSelections(new Set([1, 3]), [results[2]])], [3]);
  });
});
