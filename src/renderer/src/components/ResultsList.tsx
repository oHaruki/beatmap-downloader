import type { BeatmapsetSummary } from "@shared/types";
import { useState } from "react";

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
  const [expanded, setExpanded] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState("");
  if (results.length === 0) return <p className="empty-hint">{emptyMessage}</p>;

  const allSelected = results.every((set) => selected.has(set.id));
  return (
    <div className="results-wrap">
      {error && <p className="error-text" role="alert">{error} <button onClick={() => setError("")}>Dismiss</button></p>}
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
              <button aria-expanded={expanded === set.id} onClick={() => setExpanded(expanded === set.id ? null : set.id)}>Details</button>
              <button aria-label={preview === set.id ? "Stop preview" : `Preview ${set.title}`} onClick={() => { setError(""); setPreview(preview === set.id ? null : set.id); }}>{preview === set.id ? "Stop" : "Preview"}</button>
              {downloadedIds.has(set.id) && <button onClick={() => void window.api.revealDownload(set.id).catch(() => setError("This file is no longer in the output folder. Open download history to repair it."))}>Show file</button>}
              {preview === set.id && <audio className="beatmap-preview" controls autoPlay preload="none" src={`https://b.ppy.sh/preview/${set.id}.mp3`} onError={() => { setError("Audio preview is unavailable for this beatmap."); setPreview(null); }} onEnded={() => setPreview(null)} />}
              {expanded === set.id && <div className="difficulty-details">
                <p className="meta">The download contains the whole beatmapset. All included difficulties:</p>
                <table><thead><tr><th>Difficulty</th><th>Mode</th><th>Stars</th><th>BPM</th><th>Length</th><th>AR / CS / OD / HP</th></tr></thead>
                  <tbody>{set.beatmaps.map((beatmap) => <tr key={beatmap.id}>
                    <td><a href={`https://osu.ppy.sh/beatmaps/${beatmap.id}`} target="_blank" rel="noreferrer">{beatmap.version}</a></td>
                    <td>{beatmap.mode}</td><td>{beatmap.difficulty_rating.toFixed(2)}★</td><td>{beatmap.bpm ?? "—"}</td>
                    <td>{beatmap.total_length == null ? "—" : `${Math.floor(beatmap.total_length / 60)}:${String(beatmap.total_length % 60).padStart(2, "0")}`}</td>
                    <td>{[beatmap.ar, beatmap.cs, beatmap.accuracy, beatmap.drain].map((value) => value ?? "—").join(" / ")}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
