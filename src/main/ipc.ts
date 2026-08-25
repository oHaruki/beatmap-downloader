import { BrowserWindow, dialog, ipcMain } from "electron";
import { promises as fs } from "fs";
import type { DownloadJob, SearchFilters } from "@shared/types";
import { searchBeatmapsets, OsuApiError, hasApiCredentials, resetTokenCache } from "./osu/api";
import { findDefaultSongsFolder, listInstalledBeatmapsets } from "./osu/songs-folder";
import {
  executeImportPlan,
  planAutoImport,
  type ImportOutcome,
} from "./osu/auto-import-executor";
import { importPlanForFile } from "./osu/auto-import";
import { runDownloadQueue } from "./download/queue";
import { listDownloadedIds } from "./download/manifest";
import { loadConfig, saveConfig, getDefaultDownloadsFolder } from "./config";

// Auto-import plumbing: capture the available library targets and game
// executable once per download batch, then import each completed .osz
// independently as it lands.
interface AutoImportContext {
  run: (file: string) => Promise<ImportOutcome>;
}

async function buildAutoImportContext(): Promise<AutoImportContext | null> {
  const config = await loadConfig();
  const songsFolder = config.songsFolder ?? await findDefaultSongsFolder();
  if (!songsFolder) return null;

  const planPromise = planAutoImport(songsFolder, [], process.env.LOCALAPPDATA);
  return {
    async run(file: string): Promise<ImportOutcome> {
      const base = await planPromise;
      return executeImportPlan(importPlanForFile(base, file));
    },
  };
}

async function runImport(file: string, context: AutoImportContext): Promise<ImportOutcome> {
  try {
    return await context.run(file);
  } catch (error) {
    return {
      imported: 0,
      deferred: true,
      message: error instanceof Error ? error.message : "Import failed.",
    };
  }
}

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

  ipcMain.handle("get-auto-import-enabled", async () =>
    (await loadConfig()).autoImportEnabled
  );
  ipcMain.handle("set-auto-import-enabled", async (_event, enabled: boolean) => {
    const value = Boolean(enabled);
    await saveConfig({ autoImportEnabled: value });
    return value;
  });

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
      // Auto-import (when enabled): hand each finished .osz to the import
      // planner. The plan is built once per batch; each callback carries only
      // the newly finished file so earlier maps are never submitted again.
      const config = await loadConfig();
      const importContext = config.autoImportEnabled ? await buildAutoImportContext() : null;
      await runDownloadQueue(
        jobs,
        outDir,
        force,
        installedIds,
        (progress) => {
          win?.webContents.send("download-progress", progress);
        },
        importContext
          ? async (filePath) => {
              const result = await runImport(filePath, importContext);
              return result.message || undefined;
            }
          : undefined
      );
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
