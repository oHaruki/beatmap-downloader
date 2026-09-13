import { useEffect, useMemo, useRef, useState } from "react";
import type { DownloadJob } from "@shared/types";
import { isBareIdKind, parseBeatmapLinks, type BareIdKind } from "@shared/beatmap-links";
import { IconClose } from "./icons";

const BARE_ID_KEY = "links.bareIds";
const BARE_ID_OPTIONS: Array<{ value: BareIdKind; label: string; title: string }> = [
  { value: "beatmap", label: "Difficulty IDs", title: "A number on its own line is a difficulty ID, like mappool sheets use (osu.ppy.sh/b/...)" },
  { value: "set", label: "Set IDs", title: "A number on its own line is a beatmapset ID, like Export unfinished IDs writes (osu.ppy.sh/s/...)" },
];

function loadBareIdKind(): BareIdKind {
  try {
    const saved = localStorage.getItem(BARE_ID_KEY);
    return isBareIdKind(saved) ? saved : "beatmap";
  } catch {
    return "beatmap";
  }
}

export function LinksPanel({ downloading, canDownload, forceRedownload, onDownload, onClose }: {
  downloading: boolean;
  canDownload: boolean;
  forceRedownload: boolean;
  onDownload: (jobs: DownloadJob[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [looking, setLooking] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [bareIds, setBareIds] = useState<BareIdKind>(loadBareIdKind);
  const mounted = useRef(true);
  const parsed = useMemo(() => parseBeatmapLinks(text, bareIds), [text, bareIds]);
  const count = parsed.refs.length;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void window.api.cancelLinkLookup();
    };
  }, []);

  async function handleDownload(): Promise<void> {
    setLooking(true);
    setProblems([]);
    try {
      const result = await window.api.resolveBeatmapLinks(text, bareIds);
      if (!mounted.current || result.cancelled) return;
      setProblems(result.problems);
      if (result.jobs.length === 0) return;
      if (result.problems.length === 0) setText("");
      onDownload(result.jobs);
    } catch (error) {
      if (mounted.current) setProblems([error instanceof Error && error.message ? error.message : "Could not look up these links."]);
    } finally {
      if (mounted.current) setLooking(false);
    }
  }

  function changeBareIds(value: BareIdKind): void {
    setBareIds(value);
    try { localStorage.setItem(BARE_ID_KEY, value); } catch { /* only a convenience */ }
  }

  const summary = count === 0
    ? "No maps found yet"
    : `${count} ${count === 1 ? "map" : "maps"} found`;
  const skipped = parsed.unrecognized.length;

  return <section className="links-panel" aria-labelledby="links-title">
    <div className="history-header">
      <strong id="links-title">Download from links</strong>
      <span className="meta">
        {summary}{skipped > 0 && ` · ${skipped} ${skipped === 1 ? "line" : "lines"} not recognized`}
      </span>
      {looking
        ? <button onClick={() => void window.api.cancelLinkLookup()}>Cancel</button>
        : <button disabled={!canDownload || downloading || count === 0} onClick={() => void handleDownload()}>
            {count > 0 ? `Download ${count}` : "Download"}
          </button>}
      <button disabled={looking || text === ""} onClick={() => { setText(""); setProblems([]); }}>Clear</button>
      <button className="icon-button" aria-label="Close link download" title="Close" onClick={onClose}><IconClose /></button>
    </div>
    <textarea
      className="links-input"
      value={text}
      onChange={(event) => setText(event.target.value)}
      disabled={looking}
      spellCheck={false}
      placeholder={"https://osu.ppy.sh/beatmapsets/39804#osu/129891\nhttps://osu.ppy.sh/b/129891\n39804"}
      aria-label="Beatmap links"
    />
    <div className="links-options">
      <span className="meta">Plain numbers are</span>
      <div className="segmented" role="group" aria-label="What plain numbers mean">
        {BARE_ID_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={option.value === bareIds ? "active" : undefined}
            aria-pressed={option.value === bareIds}
            title={option.title}
            type="button"
            disabled={looking}
            onClick={() => changeBareIds(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
    <p className="meta">
      {looking
        ? "Looking up maps on osu!…"
        : `Paste set links, difficulty links or IDs, one per line or mixed with other text. Links always work, plain numbers follow the choice above. ${forceRedownload ? "Maps you already have are downloaded again." : "Maps you already have are skipped."}`}
    </p>
    {skipped > 0 && !looking && (
      <p className="meta" title={parsed.unrecognized.join("\n")}>
        Not recognized: {parsed.unrecognized.slice(0, 3).join(" · ")}{skipped > 3 && ` and ${skipped - 3} more`}
      </p>
    )}
    {problems.slice(0, 5).map((problem) => <p key={problem} className="error-text" role="alert">{problem}</p>)}
    {problems.length > 5 && <p className="error-text">and {problems.length - 5} more</p>}
  </section>;
}
