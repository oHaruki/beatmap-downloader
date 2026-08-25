import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BeatmapsetSummary,
  DownloadProgressEvent,
  InstalledSongsScan,
  SearchFilters,
} from "@shared/types";
import { FilterForm } from "./components/FilterForm";
import { ResultsList } from "./components/ResultsList";
import { DownloadPanel } from "./components/DownloadPanel";
import { TitleBar } from "./components/TitleBar";
import { DownloadBar } from "./components/DownloadBar";
import { SettingsModal } from "./components/SettingsModal";
import { OwnershipFilterBar } from "./components/OwnershipFilterBar";
import type { ResultsOwnershipFilter } from "./results-filter";
import { applyResultsFilter, retainVisibleSelections } from "./results-filter";

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
  const installedScanRef = useRef(false);

  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<number>>(new Set());
  const [songsFolder, setSongsFolder] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<number>>(new Set());
  const [installedSource, setInstalledSource] = useState<InstalledSongsScan["source"] | null>(null);
  const [forceRedownload, setForceRedownload] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<Map<number, DownloadProgressEvent>>(new Map());
  const [batchTotal, setBatchTotal] = useState(0);
  // Post-search view filter; resets to "all" whenever a new search starts.
  const [ownershipFilter, setOwnershipFilter] = useState<ResultsOwnershipFilter>("all");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsFirstRun, setSettingsFirstRun] = useState(false);

  useEffect(() => {
    void window.api.getOutputFolder().then(setOutputFolder);
    void window.api.getSongsFolder().then(setSongsFolder);
    void window.api.hasApiCredentials().then((has) => {
      if (!has) {
        setSettingsFirstRun(true);
        setShowSettings(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!outputFolder) return;
    void refreshDownloadedIds(outputFolder);
  }, [outputFolder]);

  useEffect(() => {
    if (!songsFolder) return;
    void refreshInstalledIds(songsFolder);
  }, [songsFolder]);

  // osu! only rewrites osu!.db when it exits, and a map imported while it is
  // still running shows up as nothing but a folder. Re-scanning on focus
  // means coming back from osu! after an import is enough to pick it up,
  // instead of needing a restart.
  useEffect(() => {
    if (!songsFolder) return;
    const onFocus = (): void => void refreshInstalledIds(songsFolder);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [songsFolder]);

  useEffect(() => window.api.onDownloadProgress((event) => {
    setProgress((prev) => new Map(prev).set(event.beatmapsetId, event));
    if (event.status === "done" && outputFolder) void refreshDownloadedIds(outputFolder);
  }), [outputFolder]);

  async function refreshInstalledIds(folder: string): Promise<void> {
    if (installedScanRef.current) return; // a scan is already in flight
    installedScanRef.current = true;
    try {
      const scan = await window.api.getInstalledBeatmapsetIds(folder);
      setInstalledIds(new Set(scan.ids));
      setInstalledSource(scan.source);
    } finally {
      installedScanRef.current = false;
    }
  }

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
  const visibleResults = useMemo(
    () => applyResultsFilter(results, ownershipFilter, installedIds, downloadedIds),
    [results, ownershipFilter, installedIds, downloadedIds]
  );
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
    setOwnershipFilter("all");

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
        // Everything a search turns up is selected by default, since that's
        // almost always what you want after filtering; unwanted maps get
        // unticked individually or cleared with "Deselect all".
        setSelected((prev) => {
          const next = new Set(prev);
          for (const set of result.beatmapsets) next.add(set.id);
          return next;
        });
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
    // Scope to what is visible under the active ownership filter: with
    // "Missing only" on, select-all queues exactly the shown (missing) maps.
    const visibleIds = visibleResults.map((set) => set.id);
    setSelected((prev) => {
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of visibleIds) {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function changeOwnershipFilter(nextFilter: ResultsOwnershipFilter): void {
    const nextVisible = applyResultsFilter(results, nextFilter, installedIds, downloadedIds);
    // A selection should never become an invisible queued download when the
    // view changes. Keep only selections that remain visible in the new view.
    setSelected((previous) => retainVisibleSelections(previous, nextVisible));
    setOwnershipFilter(nextFilter);
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

  const downloadLabel = downloading
    ? "Downloading..."
    : selectedRemaining === 0
      ? "Download"
      : selectedRemaining === selected.size
        ? `Download ${selected.size} selected`
        : `Download ${selectedRemaining} of ${selected.size}`;

  return (
    <div className="app-shell">
      <TitleBar />
      {showSettings && (
        <SettingsModal
          firstRun={settingsFirstRun}
          onClose={() => setShowSettings(false)}
          onSaved={() => {
            if (searchError) handleSearch();
          }}
        />
      )}
      <div className="status-bar">
        <span className={`status-dot ${statusLine.tone}`} />
        <span>{statusLine.text}</span>
      </div>
      <DownloadBar
        label={downloadLabel}
        canDownload={!downloading && Boolean(outputFolder) && selectedRemaining > 0}
        onDownload={handleDownload}
        onOpenSettings={() => {
          setSettingsFirstRun(false);
          setShowSettings(true);
        }}
        outputFolder={outputFolder}
        onChooseOutputFolder={handleChooseFolder}
        songsFolder={songsFolder}
        onChooseSongsFolder={handleChooseSongsFolder}
        installedCount={installedIds.size}
        installedSource={installedSource}
        forceRedownload={forceRedownload}
        onToggleForceRedownload={setForceRedownload}
      />

      <div className="app-body">
        <aside className="sidebar">
          <FilterForm filters={filters} onChange={setFilters} onSearch={handleSearch} loading={searchLoading} />
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

          <OwnershipFilterBar
            results={results}
            installedIds={installedIds}
            downloadedIds={downloadedIds}
            value={ownershipFilter}
            onChange={changeOwnershipFilter}
          />

          <ResultsList
            results={visibleResults}
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
