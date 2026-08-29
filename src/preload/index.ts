import { contextBridge, ipcRenderer } from "electron";
import type {
  DownloadJob,
  DownloadProgressEvent,
  CredentialSaveResult,
  InstalledSongsScan,
  RendererApi,
  SearchFilters,
  SearchResult,
} from "@shared/types";

const api: RendererApi = {
  searchBeatmapsets: (filters: SearchFilters): Promise<SearchResult> =>
    ipcRenderer.invoke("search-beatmapsets", filters),

  cancelSearch: (): Promise<boolean> => ipcRenderer.invoke("cancel-search"),

  chooseOutputFolder: (): Promise<string | null> => ipcRenderer.invoke("choose-output-folder"),

  getOutputFolder: (): Promise<string> => ipcRenderer.invoke("get-output-folder"),

  getDownloadedIds: (outDir: string): Promise<number[]> => ipcRenderer.invoke("get-downloaded-ids", outDir),

  getSongsFolder: (): Promise<string | null> => ipcRenderer.invoke("get-songs-folder"),

  chooseSongsFolder: (): Promise<string | null> => ipcRenderer.invoke("choose-songs-folder"),

  getInstalledBeatmapsetIds: (songsFolder: string): Promise<InstalledSongsScan> =>
    ipcRenderer.invoke("get-installed-beatmapset-ids", songsFolder),

  hasApiCredentials: (): Promise<boolean> => ipcRenderer.invoke("has-api-credentials"),

  setApiCredentials: (clientId: string, clientSecret: string): Promise<CredentialSaveResult> =>
    ipcRenderer.invoke("set-api-credentials", clientId, clientSecret),

  startDownload: (
    jobs: DownloadJob[],
    outDir: string,
    force: boolean,
    installedIds: number[]
  ): Promise<{ done: true }> => ipcRenderer.invoke("start-download", jobs, outDir, force, installedIds),

  cancelDownload: (): Promise<boolean> => ipcRenderer.invoke("cancel-download"),

  getAutoImportEnabled: (): Promise<boolean> => ipcRenderer.invoke("get-auto-import-enabled"),

  setAutoImportEnabled: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke("set-auto-import-enabled", enabled),

  openOutputFolder: (): Promise<string> => ipcRenderer.invoke("open-output-folder"),

  openSongsFolder: (): Promise<string> => ipcRenderer.invoke("open-songs-folder"),

  onDownloadProgress: (callback: (event: DownloadProgressEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: DownloadProgressEvent): void =>
      callback(progress);
    ipcRenderer.on("download-progress", listener);
    return () => ipcRenderer.removeListener("download-progress", listener);
  },

  windowMinimize: (): void => ipcRenderer.send("window-minimize"),
  windowToggleMaximize: (): void => ipcRenderer.send("window-toggle-maximize"),
  windowClose: (): void => ipcRenderer.send("window-close"),
  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke("window-is-maximized"),

  onWindowMaximizedChange: (callback: (maximized: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean): void => callback(maximized);
    ipcRenderer.on("window-maximized-changed", listener);
    return () => ipcRenderer.removeListener("window-maximized-changed", listener);
  },
};

contextBridge.exposeInMainWorld("api", api);
