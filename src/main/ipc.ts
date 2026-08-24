import { BrowserWindow, dialog, ipcMain } from "electron";
import { promises as fs } from "fs";
import type { DownloadJob, SearchFilters } from "@shared/types";
import { searchBeatmapsets, OsuApiError, hasApiCredentials, resetTokenCache } from "./osu/api";
import { findDefaultSongsFolder, listInstalledBeatmapsets } from "./osu/songs-folder";
import { runDownloadQueue } from "./download/queue";
import { listDownloadedIds } from "./download/manifest";
import { loadConfig, saveConfig, getDefaultDownloadsFolder } from "./config";

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
    await saveConfig({ outputFolder: result.filePaths[0] });
    return result.filePaths[0];
  });

  ipcMain.handle("get-output-folder", async () => {
    const config = await loadConfig();
    const dir = config.outputFolder ?? getDefaultDownloadsFolder();
    await fs.mkdir(dir, { recursive: true });
    if (!config.outputFolder) await saveConfig({ outputFolder: dir });
    return dir;
  });

  ipcMain.handle("get-downloaded-ids", async (_event, outDir: string) => {
    try {
      return await listDownloadedIds(outDir);
    } catch {
      return [];
    }
  });

  ipcMain.handle("get-songs-folder", async () => {
    const config = await loadConfig();
    if (config.songsFolder) return config.songsFolder;
    const found = await findDefaultSongsFolder();
    if (found) await saveConfig({ songsFolder: found });
    return found;
  });

  ipcMain.handle("choose-songs-folder", async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;
    await saveConfig({ songsFolder: result.filePaths[0] });
    return result.filePaths[0];
  });

  ipcMain.handle("get-installed-beatmapset-ids", (_event, songsFolder: string) =>
    listInstalledBeatmapsets(songsFolder)
  );

  ipcMain.handle("has-api-credentials", () => hasApiCredentials());

  ipcMain.handle("set-api-credentials", async (_event, clientId: string, clientSecret: string) => {
    await saveConfig({ osuApiClientId: clientId.trim() || null, osuApiClientSecret: clientSecret.trim() || null });
    resetTokenCache();
    return true;
  });

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
