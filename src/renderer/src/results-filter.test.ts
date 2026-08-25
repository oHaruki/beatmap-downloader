import { describe, expect, it } from "vitest";
import type { BeatmapsetSummary, DownloadProgressEvent } from "@shared/types";
import {
  applyResultsFilter,
  countByOwnership,
  retainVisibleSelections,
  type ResultsOwnershipFilter,
} from "./results-filter";

function makeSet(id: number): BeatmapsetSummary {
  return {
    id,
    title: `Title ${id}`,
    artist: "Artist",
    creator: "creator",
    status: "ranked",
    covers: {},
    beatmaps: [],
  };
}

const results = [makeSet(1), makeSet(2), makeSet(3)];
// Map 1 is installed in osu!, map 2 was downloaded here, map 3 is neither.
const installedIds = new Set([1]);
const downloadedIds = new Set([2]);

describe("countByOwnership", () => {
  it("splits results into not-downloaded, downloaded, and installed", () => {
    expect(countByOwnership(results, installedIds, downloadedIds)).toEqual({
      notDownloaded: 1,
      downloaded: 1,
      installed: 1,
      total: 3,
    });
  });
});

describe("applyResultsFilter", () => {
  it("keeps everything in the all view", () => {
    const filtered = applyResultsFilter(results, "all", installedIds, downloadedIds);
    expect(filtered.map((set) => set.id)).toEqual([1, 2, 3]);
  });

  it("puts maps you do not have first and keeps owned maps visible below", () => {
    const filtered = applyResultsFilter(results, "missing-first", installedIds, downloadedIds);
    // Not-downloaded (3) first; then already-here maps keep their order.
    expect(filtered.map((set) => set.id)).toEqual([3, 1, 2]);
  });

  it("shows only missing maps in the missing-only view", () => {
    const filtered = applyResultsFilter(results, "missing-only", installedIds, downloadedIds);
    expect(filtered.map((set) => set.id)).toEqual([3]);
  });

  it("treats a map as owned when it is installed even if also in the download manifest", () => {
    const both = new Set([1, 2]);
    const filtered = applyResultsFilter([makeSet(2)], "missing-only", new Set([2]), both);
    expect(filtered).toHaveLength(0);
  });

  it("preserves original order inside each ownership bucket", () => {
    const many = [makeSet(9), makeSet(5), makeSet(7)];
    const filtered = applyResultsFilter(many, "missing-first", new Set(), new Set());
    expect(filtered.map((set) => set.id)).toEqual([9, 5, 7]);
  });
});

describe("retainVisibleSelections", () => {
  it("drops selected maps that become hidden by a view change", () => {
    expect([...retainVisibleSelections(new Set([1, 2, 3]), [makeSet(3)])]).toEqual([3]);
  });
});

describe("progress events do not affect filtering", () => {
  it("ignores progress payloads entirely", () => {
    const event: DownloadProgressEvent = { beatmapsetId: 3, status: "done" };
    void event;
    const before = applyResultsFilter(results, "missing-only", installedIds, downloadedIds);
    expect(before).toHaveLength(1);
  });
});
