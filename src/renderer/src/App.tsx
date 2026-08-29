import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BeatmapsetSummary,
  DownloadJob,
  DownloadProgressEvent,
  InstalledSongsScan,
  SearchFilters,
} from "@shared/types";
import { DEFAULT_SEARCH_FILTERS, validateSearchFilters } from "@shared/search-filters";
import { DownloadBar } from "./components/DownloadBar";
import { DownloadPanel } from "./components/DownloadPanel";
import { FilterForm } from "./components/FilterForm";
import { OwnershipFilterBar } from "./components/OwnershipFilterBar";
import { ResultsList } from "./components/ResultsList";
import { SettingsModal } from "./components/SettingsModal";
import { TitleBar } from "./components/TitleBar";
import {
  applyResultsFilter,
  retainVisibleSelections,
  type ResultsOwnershipFilter,
} from "./results-filter";

const PAGE_DELAY_MS = 150;
const LARGE_BATCH_SIZE = 100;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function addUniqueResults(
  previous: BeatmapsetSummary[],
  incoming: BeatmapsetSummary[],
): BeatmapsetSummary[] {
  const next = new Map(previous.map((set) => [set.id, set]));
  for (const set of incoming) next.set(set.id, set);
  return [...next.values()];
}

export default function App() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);
  const [results, setResults] = useState<BeatmapsetSummary[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasCompletedSearch, setHasCompletedSearch] = useState(false);
  const [pagesFetched, setPagesFetched] = useState(0);
  const cancelSearchRef = useRef(false);
  const searchInFlightRef = useRef(false);
  const filterVersionRef = useRef(0);
  const installedScanRef = useRef(false);

  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<number>>(new Set());
  const [osuFolder, setOsuFolder] = useState<string | null>(null);
  const [songsFolder, setSongsFolder] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<number>>(new Set());
  const [installedSource, setInstalledSource] = useState<InstalledSongsScan["source"] | null>(null);
  const [forceRedownload, setForceRedownload] = useState(false);
  const [autoImport, setAutoImport] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [cancelDownloadRequested, setCancelDownloadRequested] = useState(false);
  const [progress, setProgress] = useState<Map<number, DownloadProgressEvent>>(new Map());
  const [batchTotal, setBatchTotal] = useState(0);
  const [lastBatchJobs, setLastBatchJobs] = useState<DownloadJob[]>([]);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const [ownershipFilter, setOwnershipFilter] = useState<ResultsOwnershipFilter>("all");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsFirstRun, setSettingsFirstRun] = useState(false);

  useEffect(() => {
    void window.api
      .getOutputFolder()
      .then(setOutputFolder)
      .catch((error) => setAppError(errorMessage(error, "Could not prepare the output folder.")));
    void window.api
      .getOsuFolder()
      .then((selection) => {
        setOsuFolder(selection?.osuFolder ?? null);
        setSongsFolder(selection?.songsFolder ?? null);
      })
      .catch((error) => setAppError(errorMessage(error, "Could not detect the osu! folder.")));
    void window.api
      .getAutoImportEnabled()
      .then(setAutoImport)
      .catch((error) => setAppError(errorMessage(error, "Could not load auto-import settings.")));
    void window.api
      .hasApiCredentials()
      .then((hasCredentials) => {
        if (!hasCredentials) {
          setSettingsFirstRun(true);
          setShowSettings(true);
        }
      })
      .catch((error) => setAppError(errorMessage(error, "Could not read API settings.")));
  }, []);

  useEffect(() => {
    if (outputFolder) void refreshDownloadedIds(outputFolder);
  }, [outputFolder]);

  useEffect(() => {
    if (osuFolder && songsFolder) void refreshInstalledIds(osuFolder, songsFolder);
  }, [osuFolder, songsFolder]);

  useEffect(() => {
    if (!osuFolder || !songsFolder) return;
    const onFocus = (): void => void refreshInstalledIds(osuFolder, songsFolder);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [osuFolder, songsFolder]);

  useEffect(
    () =>
      window.api.onDownloadProgress((event) => {
        setProgress((previous) => new Map(previous).set(event.beatmapsetId, event));
      }),
    [],
  );

  async function refreshInstalledIds(osuRoot: string, songs: string): Promise<void> {
    if (installedScanRef.current) return;
    installedScanRef.current = true;
    try {
      const scan = await window.api.getInstalledBeatmapsetIds(osuRoot, songs);
      setInstalledIds(new Set(scan.ids));
      setInstalledSource(scan.source);
    } catch (error) {
      setAppError(errorMessage(error, "Could not scan the osu! folder."));
    } finally {
      installedScanRef.current = false;
    }
  }

  async function refreshDownloadedIds(folder: string): Promise<void> {
    try {
      setDownloadedIds(new Set(await window.api.getDownloadedIds(folder)));
    } catch (error) {
      setAppError(errorMessage(error, "Could not read the download history."));
    }
  }

  async function handleChooseOsuFolder(): Promise<void> {
    try {
      const selection = await window.api.chooseOsuFolder();
      if (!selection) return;
      setOsuFolder(selection.osuFolder);
      setSongsFolder(selection.songsFolder);
    } catch (error) {
      setAppError(errorMessage(error, "Could not use that osu! folder."));
    }
  }

  const labels = useMemo(() => {
    const map = new Map<number, string>();
    for (const set of results) map.set(set.id, `${set.artist} - ${set.title}`);
    return map;
  }, [results]);

  const remainingInResults = results.filter(
    (set) => !installedIds.has(set.id) && !downloadedIds.has(set.id),
  ).length;
  const visibleResults = useMemo(
    () => applyResultsFilter(results, ownershipFilter, installedIds, downloadedIds),
    [results, ownershipFilter, installedIds, downloadedIds],
  );

  useEffect(() => {
    setSelected((previous) => {
      const next = retainVisibleSelections(previous, visibleResults);
      return next.size === previous.size ? previous : next;
    });
  }, [visibleResults]);

  const selectedRemaining = forceRedownload
    ? selected.size
    : [...selected].filter((id) => !installedIds.has(id) && !downloadedIds.has(id)).length;
  const activeDownloads = [...progress.values()].filter((event) => event.status === "downloading").length;
  const retryableCount = [...progress.values()].filter(
    (event) => event.status === "error" || event.status === "cancelled",
  ).length;
  const statusLine = downloading
    ? {
        text: cancelDownloadRequested
          ? "cancelling downloads"
          : activeDownloads > 0
            ? `downloading ${activeDownloads} map${activeDownloads === 1 ? "" : "s"}`
            : "starting downloads",
        tone: "busy" as const,
      }
    : searchLoading
      ? { text: "searching", tone: "busy" as const }
      : { text: "ready", tone: "ok" as const };

  async function loadAllSearchPages(): Promise<void> {
    if (searchInFlightRef.current) return;
    const validationError = validateSearchFilters(filters);
    if (validationError) {
      setSearchError(validationError);
      return;
    }
    searchInFlightRef.current = true;
    cancelSearchRef.current = false;
    setSearchLoading(true);
    setSearchError(null);
    const filterVersion = filterVersionRef.current;
    const searchFilters = { ...filters, cursorString: null };
    setHasCompletedSearch(false);
    setResults([]);
    setSelected(new Set());
    setPagesFetched(0);
    setOwnershipFilter("all");

    let cursorString: string | null = null;
    let fetchedPages = 0;
    let cancelled = false;
    const seenCursors = new Set<string>();
    try {
      while (!cancelSearchRef.current) {
        const result = await window.api.searchBeatmapsets({
          ...searchFilters,
          cursorString,
        });
        if (result.cancelled) {
          cancelled = true;
          break;
        }
        if (result.error) {
          setSearchError(result.error);
          return;
        }

        setResults((previous) => addUniqueResults(previous, result.beatmapsets));
        setSelected((previous) => {
          const next = new Set(previous);
          for (const set of result.beatmapsets) next.add(set.id);
          return next;
        });
        fetchedPages += 1;
        setPagesFetched(fetchedPages);
        if (filterVersion !== filterVersionRef.current) {
          break;
        }

        const nextCursor = result.cursorString;
        if (!nextCursor) break;
        if (seenCursors.has(nextCursor)) {
          setSearchError("Search stopped because osu! returned a repeated page cursor.");
          return;
        }
        seenCursors.add(nextCursor);
        cursorString = nextCursor;
        await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
      }
      cancelled ||= cancelSearchRef.current;
      if (!cancelled && filterVersion === filterVersionRef.current) {
        setHasCompletedSearch(true);
      }
    } catch (error) {
      setSearchError(errorMessage(error, "Search failed unexpectedly."));
    } finally {
      searchInFlightRef.current = false;
      setSearchLoading(false);
    }
  }

  function handleSearch(): void {
    void loadAllSearchPages();
  }

  function handleCancelSearch(): void {
    cancelSearchRef.current = true;
    void window.api.cancelSearch();
  }

  function toggleSelected(id: number): void {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(): void {
    const visibleIds = visibleResults.map((set) => set.id);
    setSelected((previous) => {
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => previous.has(id));
      return allVisibleSelected ? new Set() : new Set(visibleIds);
    });
  }

  function changeOwnershipFilter(nextFilter: ResultsOwnershipFilter): void {
    const nextVisible = applyResultsFilter(results, nextFilter, installedIds, downloadedIds);
    setSelected((previous) => retainVisibleSelections(previous, nextVisible));
    setOwnershipFilter(nextFilter);
  }

  async function handleChooseFolder(): Promise<void> {
    try {
      const folder = await window.api.chooseOutputFolder();
      if (folder) setOutputFolder(folder);
    } catch (error) {
      setAppError(errorMessage(error, "Could not save the output folder."));
    }
  }

  async function handleOpenFolder(kind: "output" | "osu"): Promise<void> {
    try {
      const error =
        kind === "output" ? await window.api.openOutputFolder() : await window.api.openOsuFolder();
      if (error) setAppError(error);
    } catch (error) {
      setAppError(errorMessage(error, "Could not open the folder."));
    }
  }

  async function handleToggleAutoImport(value: boolean): Promise<void> {
    const previous = autoImport;
    setAutoImport(value);
    try {
      await window.api.setAutoImportEnabled(value);
    } catch (error) {
      setAutoImport(previous);
      setAppError(errorMessage(error, "Could not save the auto-import setting."));
    }
  }

  async function startBatch(jobs: DownloadJob[]): Promise<void> {
    if (!outputFolder || jobs.length === 0 || downloading) return;
    if (jobs.length > 1_000) {
      setDownloadError("A batch can contain at most 1,000 beatmapsets. Select fewer maps and try again.");
      return;
    }
    if (
      jobs.length >= LARGE_BATCH_SIZE &&
      !window.confirm(`Download ${jobs.length.toLocaleString()} beatmapsets? This may take a while.`)
    ) {
      return;
    }

    setDownloading(true);
    setCancelDownloadRequested(false);
    setDownloadError(null);
    setProgress(new Map());
    setBatchTotal(jobs.length);
    setLastBatchJobs(jobs);
    try {
      await window.api.startDownload(jobs, outputFolder, forceRedownload, [...installedIds]);
    } catch (error) {
      setDownloadError(errorMessage(error, "The download batch could not be completed."));
    } finally {
      setDownloading(false);
      setCancelDownloadRequested(false);
      await refreshDownloadedIds(outputFolder);
      if (autoImport && osuFolder && songsFolder) {
        await refreshInstalledIds(osuFolder, songsFolder);
      }
    }
  }

  function handleDownload(): void {
    if (!outputFolder || selected.size === 0) return;
    const selectedSets = results.filter((set) => selected.has(set.id));
    const toDownload = forceRedownload
      ? selectedSets
      : selectedSets.filter((set) => !installedIds.has(set.id) && !downloadedIds.has(set.id));
    void startBatch(
      toDownload.map((set) => ({
        beatmapsetId: set.id,
        fileName: `${set.artist} - ${set.title} (${set.creator})`,
      })),
    );
  }

  function handleCancelDownload(): void {
    setCancelDownloadRequested(true);
    void window.api.cancelDownload();
  }

  function handleRetryFailed(): void {
    const retryableIds = new Set(
      [...progress.values()]
        .filter((event) => event.status === "error" || event.status === "cancelled")
        .map((event) => event.beatmapsetId),
    );
    void startBatch(lastBatchJobs.filter((job) => retryableIds.has(job.beatmapsetId)));
  }

  const downloadLabel = downloading
    ? "Downloading..."
    : selectedRemaining === 0
      ? "Download"
      : selectedRemaining === selected.size
        ? `Download ${selected.size} selected`
        : `Download ${selectedRemaining} of ${selected.size}`;
  const emptyResultsMessage = results.length > 0
    ? "No maps match the selected ownership filter."
    : hasCompletedSearch
      ? "No beatmaps matched this search."
      : "No results yet. Try a search above.";

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
        onOpenOutputFolder={() => void handleOpenFolder("output")}
        osuFolder={osuFolder}
        songsFolder={songsFolder}
        onChooseOsuFolder={handleChooseOsuFolder}
        onOpenOsuFolder={() => void handleOpenFolder("osu")}
        installedCount={installedIds.size}
        installedSource={installedSource}
        forceRedownload={forceRedownload}
        onToggleForceRedownload={setForceRedownload}
        autoImport={autoImport}
        onToggleAutoImport={(value) => void handleToggleAutoImport(value)}
      />

      <div className="app-body">
        <aside className="sidebar">
          <FilterForm
            filters={filters}
            onChange={(nextFilters) => {
              filterVersionRef.current += 1;
              setFilters(nextFilters);
            }}
            onSearch={handleSearch}
            onReset={() => {
              filterVersionRef.current += 1;
              setFilters(DEFAULT_SEARCH_FILTERS);
            }}
            loading={searchLoading}
          />
        </aside>

        <main className="main-panel">
          {appError && (
            <p className="error-text" role="alert">
              {appError} <button onClick={() => setAppError(null)}>Dismiss</button>
            </p>
          )}
          {searchError && (
            <p className="error-text" role="alert">
              {searchError}
            </p>
          )}
          {downloadError && (
            <p className="error-text" role="alert">
              {downloadError}
            </p>
          )}
          {searchLoading && (
            <p className="search-status">
              Searching... {results.length} maps found so far ({pagesFetched}{" "}
              {pagesFetched === 1 ? "page" : "pages"})
              <button onClick={handleCancelSearch}>Cancel</button>
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
            emptyMessage={emptyResultsMessage}
          />

          <DownloadPanel
            progress={progress}
            labels={labels}
            total={batchTotal}
            downloading={downloading}
            cancelling={cancelDownloadRequested}
            retryableCount={retryableCount}
            onCancel={handleCancelDownload}
            onRetry={handleRetryFailed}
          />
        </main>
      </div>
    </div>
  );
}
