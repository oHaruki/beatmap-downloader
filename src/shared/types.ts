export type BeatmapStatus =
  | "any"
  | "ranked"
  | "qualified"
  | "loved"
  | "pending"
  | "wip"
  | "graveyard";

export interface SearchFilters {
  query: string;
  mode: "" | "0" | "1" | "2" | "3"; // "" = any, else osu!/taiko/catch/mania
  status: BeatmapStatus;
  starsMin: string;
  starsMax: string;
  bpmMin: string;
  bpmMax: string;
  lengthMin: string; // seconds
  lengthMax: string; // seconds
  arMin: string;
  arMax: string;
  csMin: string;
  csMax: string;
  odMin: string;
  odMax: string;
  hpMin: string;
  hpMax: string;
  cursorString?: string | null;
  sort?: string;
  keys?: string;
  rankedFrom?: string;
  rankedTo?: string;
}

export interface BeatmapDifficulty {
  id: number;
  version: string;
  mode: string;
  difficulty_rating: number;
  bpm?: number;
  total_length?: number;
  ar?: number;
  cs?: number;
  accuracy?: number;
  drain?: number;
}

export interface BeatmapsetSummary {
  id: number;
  title: string;
  artist: string;
  creator: string;
  status: string;
  covers: { card?: string };
  beatmaps: BeatmapDifficulty[];
  preview_url?: string;
}

export interface SearchPreset { name: string; filters: SearchFilters }
export interface CredentialSettings { clientId: string; hasSecret: boolean; remember: boolean }
export interface DownloadHistoryEntry extends DownloadJob {
  downloadedAt: string;
  path: string;
  exists: boolean;
}

export interface SearchResult {
  beatmapsets: BeatmapsetSummary[];
  cursorString: string | null;
  error?: string;
  cancelled?: boolean;
}

export type DownloadStatus = "queued" | "downloading" | "done" | "error" | "skipped" | "cancelled";

export interface DownloadJob {
  beatmapsetId: number;
  fileName: string;
}

export interface DownloadProgressEvent {
  beatmapsetId: number;
  status: DownloadStatus;
  message?: string;
  /** 0-100, or null while size is unknown (renderer shows an indeterminate bar). */
  progressPercent?: number | null;
  /** Hostname of the mirror that completed the download. */
  mirror?: string;
}

export type CredentialSaveResult = { ok: true } | { ok: false; error: string };

export interface OsuFolderSelection {
  osuFolder: string;
  songsFolder: string;
}

export interface OsuFolderSettings {
  remember: boolean;
  autoDetect: boolean;
}

/** Result of scanning an osu!stable install for installed beatmapsets. */
export interface InstalledSongsScan {
  ids: number[];
  /** Which source(s) the ids came from, so a bad count can be traced in the UI. */
  source: "osu!.db" | "folder names" | "osu!.db + folder names";
  /** Per-source counts, shown in the Songs folder tooltip. */
  fromOsuDb: number;
  fromFolderNames: number;
}

// Defined here rather than in preload/ so the renderer's Window
// augmentation doesn't cross a TS project-reference boundary to see it.
export interface RendererApi {
  searchBeatmapsets: (filters: SearchFilters) => Promise<SearchResult>;
  cancelSearch: () => Promise<boolean>;
  chooseOutputFolder: () => Promise<string | null>;
  getOutputFolder: () => Promise<string>;
  getDownloadedIds: (outDir: string) => Promise<number[]>;
  getOsuFolder: () => Promise<OsuFolderSelection | null>;
  getOsuFolderSettings: () => Promise<OsuFolderSettings>;
  setOsuFolderSettings: (settings: OsuFolderSettings) => Promise<OsuFolderSelection | null>;
  chooseOsuFolder: () => Promise<OsuFolderSelection | null>;
  getInstalledBeatmapsetIds: (
    osuFolder: string,
    songsFolder: string,
  ) => Promise<InstalledSongsScan>;
  hasApiCredentials: () => Promise<boolean>;
  getCredentialSettings: () => Promise<CredentialSettings>;
  setApiCredentials: (clientId: string, clientSecret: string, remember: boolean) => Promise<CredentialSaveResult>;
  forgetApiCredentials: () => Promise<void>;
  getSearchPresets: () => Promise<SearchPreset[]>;
  saveSearchPresets: (presets: SearchPreset[]) => Promise<SearchPreset[]>;
  getDownloadHistory: () => Promise<DownloadHistoryEntry[]>;
  revealDownload: (id: number) => Promise<void>;
  exportFailedIds: (ids: number[]) => Promise<boolean>;
  startDownload: (
    jobs: DownloadJob[],
    outDir: string,
    force: boolean,
    installedIds: number[]
  ) => Promise<{ done: true }>;
  cancelDownload: () => Promise<boolean>;
  getAutoImportEnabled: () => Promise<boolean>;
  setAutoImportEnabled: (enabled: boolean) => Promise<boolean>;
  openOutputFolder: () => Promise<string>;
  openOsuFolder: () => Promise<string>;
  onDownloadProgress: (callback: (event: DownloadProgressEvent) => void) => () => void;
  windowMinimize: () => void;
  windowToggleMaximize: () => void;
  windowClose: () => void;
  windowIsMaximized: () => Promise<boolean>;
  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
}
