import type { BeatmapsetSummary } from "@shared/types";

interface Props {
  results: BeatmapsetSummary[];
  selected: Set<number>;
  downloadedIds: Set<number>;
  installedIds: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
}

function starRange(set: BeatmapsetSummary): string {
  const ratings = set.beatmaps.map((b) => b.difficulty_rating).filter((n) => Number.isFinite(n));
  if (ratings.length === 0) return "?";
  const min = Math.min(...ratings).toFixed(1);
  const max = Math.max(...ratings).toFixed(1);
  return min === max ? `${min}★` : `${min}-${max}★`;
}

export function ResultsList({ results, selected, downloadedIds, installedIds, onToggle, onToggleAll }: Props) {
  if (results.length === 0) {
    return <p className="empty-hint">No results yet. Try a search above.</p>;
  }

  const allSelected = results.length > 0 && results.every((set) => selected.has(set.id));

  return (
    <div className="results-wrap">
      <label className="select-all-row">
        <input type="checkbox" checked={allSelected} onChange={onToggleAll} />
        {allSelected ? "Deselect all" : "Select all"} ({selected.size}/{results.length})
      </label>
      <div className="results-list">
        {results.map((set) => {
          const installed = installedIds.has(set.id);
          const downloaded = !installed && downloadedIds.has(set.id);
          return (
            <label className={`result-row${installed || downloaded ? " downloaded" : ""}`} key={set.id}>
              <input type="checkbox" checked={selected.has(set.id)} onChange={() => onToggle(set.id)} />
              <span className="result-title">
                {set.artist} - {set.title}
              </span>
              <span className="meta">
                by {set.creator} · {set.status} · {starRange(set)}
              </span>
              {installed && <span className="downloaded-badge">✓ in your osu!</span>}
              {downloaded && <span className="downloaded-badge">✓ downloaded here</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}
