import type { BeatmapsetSummary } from "@shared/types";

export type ResultsOwnershipFilter = "all" | "missing-first" | "missing-only";

export interface OwnershipCounts {
  missing: number;
  downloaded: number;
  installed: number;
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
  return { installed, downloaded, missing: results.length - installed - downloaded };
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
    const alreadyHave = installedIds.has(set.id) || downloadedIds.has(set.id);
    (alreadyHave ? owned : missing).push(set);
  }

  return filter === "missing-first" ? [...missing, ...owned] : missing;
}

export function retainVisibleSelections(
  selected: Set<number>,
  visibleResults: BeatmapsetSummary[],
): Set<number> {
  const visibleIds = new Set(visibleResults.map((set) => set.id));
  return new Set([...selected].filter((id) => visibleIds.has(id)));
}
