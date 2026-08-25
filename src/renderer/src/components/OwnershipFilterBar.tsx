import type { BeatmapsetSummary } from "@shared/types";
import {
  countByOwnership,
  type ResultsOwnershipFilter,
} from "../results-filter";

interface Props {
  results: BeatmapsetSummary[];
  installedIds: Set<number>;
  downloadedIds: Set<number>;
  value: ResultsOwnershipFilter;
  onChange: (value: ResultsOwnershipFilter) => void;
}

const OPTIONS: Array<{
  value: ResultsOwnershipFilter;
  label: string;
  title: string;
}> = [
  { value: "all", label: "All", title: "Show every result in search order" },
  {
    value: "missing-first",
    label: "New on top",
    title: "Keep every result visible, with maps you do not have first",
  },
  {
    value: "missing-only",
    label: "Missing only",
    title: "Hide maps already installed or downloaded",
  },
];

export function OwnershipFilterBar({
  results,
  installedIds,
  downloadedIds,
  value,
  onChange,
}: Props) {
  if (results.length === 0) return null;

  const counts = countByOwnership(results, installedIds, downloadedIds);
  return (
    <div aria-label="Filter search results by ownership">
      <div className="chip-row">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`chip${option.value === value ? " active" : ""}`}
            title={option.title}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="search-status">
        {counts.notDownloaded.toLocaleString()} you do not have ·{" "}
        {(counts.installed + counts.downloaded).toLocaleString()} already here
      </p>
    </div>
  );
}
