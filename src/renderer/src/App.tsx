import { useEffect, useMemo, useRef, useState } from "react";
import type { BeatmapsetSummary, DownloadProgressEvent, SearchFilters } from "@shared/types";
import { FilterForm } from "./components/FilterForm";
import { ResultsList } from "./components/ResultsList";
import { DownloadPanel } from "./components/DownloadPanel";
import { TitleBar } from "./components/TitleBar";

const DEFAULT_FILTERS: SearchFilters = {
  query: "",
  mode: "",
  status: "ranked",
  starsMin: "",
  starsMax: "",
  bpmMin: "",
  bpmMax: "",
  lengthMin: "",
  lengthMax: "",
  arMin: "",
  arMax: "",
  csMin: "",
  csMax: "",
  odMin: "",
  odMax: "",
  hpMin: "",
  hpMax: "",
};

const PAGE_DELAY_MS = 150; // stay well under the API's courtesy rate limit

export default function App() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<BeatmapsetSummary[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pagesFetched, setPagesFetched] = useState(0);
  const cancelSearchRef = useRef(false);

  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<number>>(new Set());
  const [songsFolder, setSongsFolder] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<number>>(new Set());
  const [forceRedownload, setForceRedownload] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<Map<number, DownloadProgressEvent>>(new Map());
  const [batchTotal, setBatchTotal] = useState(0);

  useEffect(() => {
    void window.api.getDefaultOutputFolder().then(setOutputFolder);
    void window.api.getDefaultSongsFolder().then(setSongsFolder);
  }, []);

  useEffect(() => {
    if (!outputFolder) return;
    void refreshDownloadedIds(outputFolder);
  }, [outputFolder]);

  useEffect(() => {
    if (!songsFolder) return;
    void window.api.getInstalledBeatmapsetIds(songsFolder).then((ids) => setInstalledIds(new Set(ids)));
  }, [songsFolder]);

  useEffect(() => window.api.onDownloadProgress((event) => {
    setProgress((prev) => new Map(prev).set(event.beatmapsetId, event));
    if (event.status === "done" && outputFolder) void refreshDownloadedIds(outputFolder);
  }), [outputFolder]);

  async function refreshDownloadedIds(folder: string): Promise<void> {
    const ids = await window.api.getDownloadedIds(folder);
    setDownloadedIds(new Set(ids));
  }

  async function handleChooseSongsFolder(): Promise<void> {
    const folder = await window.api.chooseSongsFolder();
    if (folder) setSongsFolder(folder);
  }

  const labels = useMemo(() => {
    const map = new Map<number, string>();
    for (const set of results) map.set(set.id, `${set.artist} - ${set.title}`);
    return map;
  }, [results]);

  const remainingInResults = results.filter(
    (set) => !installedIds.has(set.id) && !downloadedIds.has(set.id)
  ).length;
  const selectedRemaining = forceRedownload
    ? selected.size
    : [...selected].filter((id) => !installedIds.has(id) && !downloadedIds.has(id)).length;

  const activeDownloads = [...progress.values()].filter((e) => e.status === "downloading").length;
  const statusLine = activeDownloads > 0
    ? { text: `downloading ${activeDownloads} map${activeDownloads === 1 ? "" : "s"}`, tone: "busy" as const }
    : searchLoading
      ? { text: "searching", tone: "busy" as const }
      : { text: "ready", tone: "ok" as const };

  async function runSearch(): Promise<void> {
    cancelSearchRef.current = false;
    setSearchLoading(true);
    setSearchError(null);
    setResults([]);
    setPagesFetched(0);

    let cursorString: string | null = null;
    let page = 0;
    try {
      for (;;) {
        const result = await window.api.searchBeatmapsets({ ...filters, cursorString });
        if (result.error) {
          setSearchError(result.error);
          return;
        }
        setResults((prev) => [...prev, ...result.beatmapsets]);
        page += 1;
        setPagesFetched(page);

        cursorString = result.cursorString;
        if (!cursorString || result.beatmapsets.length === 0 || cancelSearchRef.current) break;
        await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
      }
    } finally {
      setSearchLoading(false);
    }
  }

  function handleSearch(): void {
    setSelected(new Set());
    void runSearch();
  }

  function handleCancelSearch(): void {
    cancelSearchRef.current = true;
  }

  function toggleSelected(id: number): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(): void {
    setSelected((prev) => (prev.size === results.length ? new Set() : new Set(results.map((r) => r.id))));
  }

  async function handleChooseFolder(): Promise<void> {
    const folder = await window.api.chooseOutputFolder();
    if (folder) setOutputFolder(folder);
  }

  async function handleDownload(): Promise<void> {
    if (!outputFolder || selected.size === 0) return;
    setDownloading(true);
    setProgress(new Map());

    const selectedSets = results.filter((set) => selected.has(set.id));
    // Excluded here, not just left for the queue's own skip check, so
    // already-owned maps never show up as "downloading" in the first place.
    const toDownload = forceRedownload
      ? selectedSets
      : selectedSets.filter((set) => !installedIds.has(set.id) && !downloadedIds.has(set.id));

    setBatchTotal(toDownload.length);
    const jobs = toDownload.map((set) => ({
      beatmapsetId: set.id,
      fileName: `${set.artist} - ${set.title} (${set.creator})`,
    }));
    try {
      await window.api.startDownload(jobs, outputFolder, forceRedownload, [...installedIds]);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="status-bar">
        <span className={`status-dot ${statusLine.tone}`} />
        <span>{statusLine.text}</span>
      </div>

      <div className="app-body">
        <aside className="sidebar">
          <FilterForm filters={filters} onChange={setFilters} onSearch={handleSearch} loading={searchLoading} />

          <div className="output-row">
            <button onClick={handleChooseFolder}>Output folder</button>
            <span className="output-path">{outputFolder ?? "loading..."}</span>
          </div>
          <label className="force-redownload">
            <input type="checkbox" checked={forceRedownload} onChange={(e) => setForceRedownload(e.target.checked)} />
            re-download already-downloaded
          </label>

          <div className="output-row">
            <button onClick={handleChooseSongsFolder}>osu! Songs folder</button>
            <span className="output-path">{songsFolder ?? "not set"}</span>
          </div>
          {songsFolder && <span className="meta-inline">{installedIds.size} maps detected</span>}

          <button
            className="primary-button"
            onClick={handleDownload}
            disabled={downloading || !outputFolder || selectedRemaining === 0}
          >
            {downloading
              ? "Downloading..."
              : selectedRemaining === selected.size
                ? `Download ${selected.size} selected`
                : `Download ${selectedRemaining} of ${selected.size} (rest already have)`}
          </button>
        </aside>

        <main className="main-panel">
          {searchError && <p className="error-text">{searchError}</p>}
          {searchLoading && (
            <p className="search-status">
              Searching... {results.length} maps found so far ({pagesFetched} pages)
              <button onClick={handleCancelSearch} style={{ marginLeft: 8 }}>
                Cancel
              </button>
            </p>
          )}
          {!searchLoading && results.length > 0 && (
            <p className="search-status">
              {results.length} maps found, {remainingInResults} you do not have yet.
            </p>
          )}

          <ResultsList
            results={results}
            selected={selected}
            downloadedIds={downloadedIds}
            installedIds={installedIds}
            onToggle={toggleSelected}
            onToggleAll={toggleSelectAll}
          />

          <DownloadPanel progress={progress} labels={labels} total={batchTotal} />
        </main>
      </div>
    </div>
  );
}
