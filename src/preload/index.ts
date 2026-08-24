import { contextBridge, ipcRenderer } from "electron";
import type {
  DownloadJob,
  DownloadProgressEvent,
  RendererApi,
  SearchFilters,
  SearchResult,
} from "@shared/types";

const api: RendererApi = {
  searchBeatmapsets: (filters: SearchFilters): Promise<SearchResult> =>
    ipcRenderer.invoke("search-beatmapsets", filters),

  chooseOutputFolder: (): Promise<string | null> => ipcRenderer.invoke("choose-output-folder"),

  getDefaultOutputFolder: (): Promise<string> => ipcRenderer.invoke("get-default-output-folder"),

  getDownloadedIds: (outDir: string): Promise<number[]> => ipcRenderer.invoke("get-downloaded-ids", outDir),

  getDefaultSongsFolder: (): Promise<string | null> => ipcRenderer.invoke("get-default-songs-folder"),

  chooseSongsFolder: (): Promise<string | null> => ipcRenderer.invoke("choose-songs-folder"),

  getInstalledBeatmapsetIds: (songsFolder: string): Promise<number[]> =>
    ipcRenderer.invoke("get-installed-beatmapset-ids", songsFolder),

  startDownload: (
    jobs: DownloadJob[],
    outDir: string,
    force: boolean,
    installedIds: number[]
  ): Promise<{ done: true }> => ipcRenderer.invoke("start-download", jobs, outDir, force, installedIds),

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
