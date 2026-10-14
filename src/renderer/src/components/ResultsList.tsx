import type { BeatmapsetSummary } from "@shared/types";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { rowWindow, type TallRow } from "../row-window";
import { IconChevron, IconExternal, IconFolder, IconPlay, IconStop } from "./icons";

// A search can match tens of thousands of maps (osu! ranked alone is over
// 37,000), and a row with a cover image for every one of them took the
// renderer past 3 GB. Only rows within this distance of the viewport are in
// the DOM.
const OVERSCAN_PX = 800;
// Replaced by the measured height as soon as a row is on screen.
const ROW_HEIGHT_GUESS = 49;

function initializePreviewVolume(element: HTMLAudioElement | null): void {
  if (element) element.volume = 0.1;
}

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

export function ResultsList(props: Props) {
  if (props.results.length === 0) return <p className="empty-hint">{props.emptyMessage}</p>;
  return <ResultRows {...props} />;
}

function ResultRows({ results, selected, downloadedIds, installedIds, onToggle }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, height: 0 });
  const [rowHeight, setRowHeight] = useState(ROW_HEIGHT_GUESS);
  // Measured heights of rows showing their difficulties or preview player.
  const [openHeights, setOpenHeights] = useState<ReadonlyMap<number, number>>(() => new Map());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = (): void => setView({ top: list.scrollTop, height: list.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  const tallRows = useMemo(() => {
    const rows: TallRow[] = [];
    for (const [id, height] of openHeights) {
      const index = results.findIndex((set) => set.id === id);
      if (index >= 0) rows.push({ index, height });
    }
    return rows;
  }, [results, openHeights]);

  const { start, end, before, after } = rowWindow(
    results.length,
    rowHeight,
    tallRows,
    view.top - OVERSCAN_PX,
    view.top + view.height + OVERSCAN_PX,
  );

  // Keep the layout in line with the heights the rendered rows really have.
  useLayoutEffect(() => {
    const rows = rowsRef.current;
    if (!rows) return;
    let plainHeight: number | undefined;
    const measured = new Map<number, number>();
    for (const row of rows.children) {
      const id = Number((row as HTMLElement).dataset.id);
      const open = id === expanded || id === preview;
      if (!open && plainHeight !== undefined) continue;
      const height = row.getBoundingClientRect().height;
      if (open) measured.set(id, height);
      else plainHeight = height;
    }
    if (plainHeight !== undefined && Math.abs(plainHeight - rowHeight) > 0.5) setRowHeight(plainHeight);

    const next = new Map<number, number>();
    for (const id of [expanded, preview]) {
      const height = id === null ? undefined : (measured.get(id) ?? openHeights.get(id));
      if (id !== null && height !== undefined) next.set(id, height);
    }
    const changed =
      next.size !== openHeights.size ||
      [...next].some(([id, height]) => Math.abs((openHeights.get(id) ?? -1) - height) > 0.5);
    if (changed) setOpenHeights(next);
  });

  // The player goes away with its row, so a preview scrolled far out of view
  // has stopped playing.
  const previewIndex = preview === null ? -1 : results.findIndex((set) => set.id === preview);
  useEffect(() => {
    if (preview !== null && (previewIndex < start || previewIndex >= end)) setPreview(null);
  }, [preview, previewIndex, start, end]);

  return (
    <>
      {error && <p className="alert" role="alert"><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></p>}
      <div
        className="results-list"
        ref={listRef}
        onScroll={(event) => setView({ top: event.currentTarget.scrollTop, height: event.currentTarget.clientHeight })}
      >
        <div ref={rowsRef} style={{ paddingTop: before, paddingBottom: after }}>
          {results.slice(start, end).map((set) => {
            const installed = installedIds.has(set.id);
            const downloaded = !installed && downloadedIds.has(set.id);
            const inputId = `beatmapset-${set.id}`;
            const name = `${set.artist} - ${set.title}`;
            const previewing = preview === set.id;
            const open = expanded === set.id;
            return (
              <div className={`result-row${installed || downloaded ? " owned" : ""}`} key={set.id} data-id={set.id}>
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
                {previewing && <div className="preview-row"><audio className="beatmap-preview" controls autoPlay preload="none" ref={initializePreviewVolume} src={`https://b.ppy.sh/preview/${set.id}.mp3`} onError={() => { setError("Audio preview is unavailable for this beatmap."); setPreview(null); }} onEnded={() => setPreview(null)} /></div>}
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
      </div>
    </>
  );
}
