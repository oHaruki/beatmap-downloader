export type BeatmapStatus = "any" | "ranked" | "qualified" | "loved" | "pending" | "graveyard";

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
}

export interface BeatmapDifficulty {
  id: number;
  version: string;
  mode: string;
  difficulty_rating: number;
}

export interface BeatmapsetSummary {
  id: number;
  title: string;
  artist: string;
  creator: string;
  status: string;
  covers: { card?: string };
  beatmaps: BeatmapDifficulty[];
}

export interface SearchResult {
  beatmapsets: BeatmapsetSummary[];
  cursorString: string | null;
  error?: string;
}

export type DownloadStatus = "queued" | "downloading" | "done" | "error" | "skipped";

/** Which osu! install a library folder belongs to. */
export type LibraryKind = "stable" | "lazer";

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
  chooseOutputFolder: () => Promise<string | null>;
  getOutputFolder: () => Promise<string>;
  getDownloadedIds: (outDir: string) => Promise<number[]>;
  getSongsFolder: () => Promise<string | null>;
  chooseSongsFolder: () => Promise<string | null>;
  getInstalledBeatmapsetIds: (songsFolder: string) => Promise<InstalledSongsScan>;
  hasApiCredentials: () => Promise<boolean>;
  setApiCredentials: (clientId: string, clientSecret: string) => Promise<boolean>;
  startDownload: (
    jobs: DownloadJob[],
    outDir: string,
    force: boolean,
    installedIds: number[]
  ) => Promise<{ done: true }>;
  getAutoImportEnabled: () => Promise<boolean>;
  setAutoImportEnabled: (enabled: boolean) => Promise<boolean>;
  onDownloadProgress: (callback: (event: DownloadProgressEvent) => void) => () => void;
  windowMinimize: () => void;
  windowToggleMaximize: () => void;
  windowClose: () => void;
  windowIsMaximized: () => Promise<boolean>;
  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
}
