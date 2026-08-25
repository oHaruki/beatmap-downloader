// Post-search ownership filtering: lets the user push maps they don't have to
// the top (or hide the ones they already own) without re-running the search.
import type { BeatmapsetSummary } from "@shared/types";

export type ResultsOwnershipFilter = "all" | "missing-first" | "missing-only";

export interface OwnershipCounts {
  notDownloaded: number;
  downloaded: number;
  installed: number;
  total: number;
}

export function isOwned(
  set: BeatmapsetSummary,
  installedIds: Set<number>,
  downloadedIds: Set<number>,
): boolean {
  // Installed in osu! wins over a leftover entry in this folder's manifest.
  return installedIds.has(set.id) || (!installedIds.has(set.id) && downloadedIds.has(set.id));
}

export function countByOwnership(
  results: BeatmapsetSummary[],
  installedIds: Set<number>,
  downloadedIds: Set<number>,
): OwnershipCounts {
  let installed = 0;
  let downloaded = 0;
  for (const set of results) {
    if (installedIds.has(set.id)) installed += 1;
    else if (downloadedIds.has(set.id)) downloaded += 1;
  }
  return { installed, downloaded, notDownloaded: results.length - installed - downloaded, total: results.length };
}

export function applyResultsFilter(
  results: BeatmapsetSummary[],
  filter: ResultsOwnershipFilter,
  installedIds: Set<number>,
  downloadedIds: Set<number>,
): BeatmapsetSummary[] {
  if (filter === "all") return results;

  const missing: BeatmapsetSummary[] = [];
  const owned: BeatmapsetSummary[] = [];
  for (const set of results) {
    (isOwned(set, installedIds, downloadedIds) ? owned : missing).push(set);
  }

  // "missing-first" keeps everything visible but pushes new maps to the top;
  // original order is preserved inside each bucket for stable scrolling.
  return filter === "missing-first" ? [...missing, ...owned] : missing;
}

export function retainVisibleSelections(
  selected: Set<number>,
  visibleResults: BeatmapsetSummary[],
): Set<number> {
  const visibleIds = new Set(visibleResults.map((set) => set.id));
  return new Set([...selected].filter((id) => visibleIds.has(id)));
}
