import type { BeatmapsetSummary } from "@shared/types";
import { useState } from "react";
import { IconChevron, IconExternal, IconFolder, IconPlay, IconStop } from "./icons";

interface Props {
  results: BeatmapsetSummary[];
  selected: Set<number>;
  downloadedIds: Set<number>;
  installedIds: Set<number>;
  onToggle: (id: number) => void;
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
  emptyMessage,
}: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState("");
  if (results.length === 0) return <p className="empty-hint">{emptyMessage}</p>;

  return (
    <>
      {error && <p className="alert" role="alert"><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></p>}
      <div className="results-list">
        {results.map((set) => {
          const installed = installedIds.has(set.id);
          const downloaded = !installed && downloadedIds.has(set.id);
          const inputId = `beatmapset-${set.id}`;
          const name = `${set.artist} - ${set.title}`;
          const previewing = preview === set.id;
          const open = expanded === set.id;
          return (
            <div className={`result-row${installed || downloaded ? " owned" : ""}`} key={set.id}>
              <input
                id={inputId}
                type="checkbox"
                checked={selected.has(set.id)}
                onChange={() => onToggle(set.id)}
                aria-label={`Select ${name}`}
              />
              {set.covers.card ? (
                <img
                  className="result-cover"
                  src={set.covers.card}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="result-cover" />
              )}
              <label className="result-details" htmlFor={inputId}>
                <span className="result-title">{name}</span>
                <span className="meta">
                  by {set.creator} · {set.status} · {starRange(set)}
                  {installed && <span className="owned-badge">installed</span>}
                  {downloaded && <span className="owned-badge">downloaded here</span>}
                </span>
              </label>
              <div className="row-actions">
                <button
                  className="icon-button"
                  aria-pressed={previewing}
                  aria-label={previewing ? `Stop preview of ${set.title}` : `Preview ${set.title}`}
                  title={previewing ? "Stop preview" : "Preview"}
                  onClick={() => { setError(""); setPreview(previewing ? null : set.id); }}
                >
                  {previewing ? <IconStop /> : <IconPlay />}
                </button>
                <button
                  className="icon-button"
                  aria-expanded={open}
                  aria-label={`Difficulties of ${name}`}
                  title="Difficulties"
                  onClick={() => setExpanded(open ? null : set.id)}
                >
                  <IconChevron className={`chevron${open ? " open" : ""}`} />
                </button>
                <a
                  className="icon-button"
                  href={`https://osu.ppy.sh/beatmapsets/${set.id}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${name} on osu!`}
                  title="Open on osu!"
                >
                  <IconExternal />
                </a>
                {downloadedIds.has(set.id) && (
                  <button
                    className="icon-button"
                    aria-label={`Show the downloaded file of ${name}`}
                    title="Show file"
                    onClick={() => void window.api.revealDownload(set.id).catch(() => setError("This file is no longer in the output folder. Open download history to repair it."))}
                  >
                    <IconFolder />
                  </button>
                )}
              </div>
              {previewing && <div className="preview-row"><audio className="beatmap-preview" controls autoPlay preload="none" ref={(el) => { if (el) el.volume = 0.1; }} src={`https://b.ppy.sh/preview/${set.id}.mp3`} onError={() => { setError("Audio preview is unavailable for this beatmap."); setPreview(null); }} onEnded={() => setPreview(null)} /></div>}
              {open && <div className="difficulty-details">
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
    </>
  );
}
