import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { promises as fs } from "fs";
import path from "path";
import type { DownloadJob, SearchFilters } from "@shared/types";
import { searchBeatmapsets, OsuApiError } from "./osu/api";
import { findDefaultSongsFolder, listInstalledBeatmapsetIds } from "./osu/songs-folder";
import { runDownloadQueue } from "./download/queue";
import { listDownloadedIds } from "./download/manifest";

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle("search-beatmapsets", async (_event, filters: SearchFilters) => {
    try {
      const result = await searchBeatmapsets(filters);
      return result;
    } catch (e) {
      const message = e instanceof OsuApiError ? e.message : "Search failed unexpectedly.";
      return { beatmapsets: [], cursorString: null, error: message };
    }
  });

  ipcMain.handle("choose-output-folder", async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("get-default-output-folder", async () => {
    const dir = path.join(app.getPath("downloads"), "beatmap-downloader");
    await fs.mkdir(dir, { recursive: true });
    return dir;
  });

  ipcMain.handle("get-downloaded-ids", async (_event, outDir: string) => {
    try {
      return await listDownloadedIds(outDir);
    } catch {
      return [];
    }
  });

  ipcMain.handle("get-default-songs-folder", () => findDefaultSongsFolder());

  ipcMain.handle("choose-songs-folder", async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("get-installed-beatmapset-ids", (_event, songsFolder: string) =>
    listInstalledBeatmapsetIds(songsFolder)
  );

  ipcMain.handle(
    "start-download",
    async (_event, jobs: DownloadJob[], outDir: string, force: boolean, installedIds: number[]) => {
      const win = getWindow();
      await runDownloadQueue(jobs, outDir, force, installedIds, (progress) => {
        win?.webContents.send("download-progress", progress);
      });
      return { done: true };
    }
  );

  ipcMain.on("window-minimize", () => getWindow()?.minimize());
  ipcMain.on("window-toggle-maximize", () => {
    const win = getWindow();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on("window-close", () => getWindow()?.close());
  ipcMain.handle("window-is-maximized", () => getWindow()?.isMaximized() ?? false);
}
