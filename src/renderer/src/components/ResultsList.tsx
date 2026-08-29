import type { BeatmapsetSummary } from "@shared/types";

interface Props {
  results: BeatmapsetSummary[];
  selected: Set<number>;
  downloadedIds: Set<number>;
  installedIds: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  emptyMessage: string;
}

function starRange(set: BeatmapsetSummary): string {
  const ratings = set.beatmaps
    .map((beatmap) => beatmap.difficulty_rating)
    .filter((rating) => Number.isFinite(rating));
  if (ratings.length === 0) return "?";
  const minimum = Math.min(...ratings).toFixed(1);
  const maximum = Math.max(...ratings).toFixed(1);
  return minimum === maximum ? `${minimum}★` : `${minimum}-${maximum}★`;
}

export function ResultsList({
  results,
  selected,
  downloadedIds,
  installedIds,
  onToggle,
  onToggleAll,
  emptyMessage,
}: Props) {
  if (results.length === 0) return <p className="empty-hint">{emptyMessage}</p>;

  const allSelected = results.every((set) => selected.has(set.id));
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
          const inputId = `beatmapset-${set.id}`;
          return (
            <div className={`result-row${installed || downloaded ? " downloaded" : ""}`} key={set.id}>
              <input
                id={inputId}
                type="checkbox"
                checked={selected.has(set.id)}
                onChange={() => onToggle(set.id)}
                aria-label={`Select ${set.artist} - ${set.title}`}
              />
              {set.covers.card && (
                <img
                  className="result-cover"
                  src={set.covers.card}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              )}
              <label className="result-details" htmlFor={inputId}>
                <span className="result-title">
                  {set.artist} - {set.title}
                </span>
                <span className="meta">
                  by {set.creator} · {set.status} · {starRange(set)}
                </span>
              </label>
              {installed && <span className="downloaded-badge">✓ installed</span>}
              {downloaded && <span className="downloaded-badge">✓ downloaded here</span>}
              <a
                className="result-link"
                href={`https://osu.ppy.sh/beatmapsets/${set.id}`}
                target="_blank"
                rel="noreferrer"
                title="Open this beatmapset on osu!"
              >
                View
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
