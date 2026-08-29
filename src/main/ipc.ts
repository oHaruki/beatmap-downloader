import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DownloadJob, DownloadProgressEvent } from "@shared/types";
import { parseSearchFilters, validateSearchFilters } from "@shared/search-filters";
import {
  hasApiCredentials,
  OsuApiError,
  resetTokenCache,
  searchBeatmapsets,
  verifyApiCredentials,
} from "./osu/api";
import { findDefaultSongsFolder, listInstalledBeatmapsets } from "./osu/songs-folder";
import { executeImportPlan, planAutoImport, type ImportOutcome } from "./osu/auto-import-executor";
import { importPlanForFile } from "./osu/auto-import";
import { runDownloadQueue } from "./download/queue";
import { listDownloadedIds } from "./download/manifest";
import { getDefaultDownloadsFolder, loadConfig, saveConfig } from "./config";
import { isRecord } from "./json-file";

const MAX_BATCH_JOBS = 1_000;
const MAX_INSTALLED_IDS = 2_000_000;

let activeSearchController: AbortController | null = null;
let activeDownloadController: AbortController | null = null;

interface AutoImportContext {
  run: (file: string) => Promise<ImportOutcome>;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

function requiredString(value: unknown, label: string, maximumLength = 32_767): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximumLength) {
    throw new TypeError(`${label} is invalid.`);
  }
  return value;
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string): string => path.resolve(value).replace(/[\\/]+$/, "").toLowerCase();
  return normalize(left) === normalize(right);
}

function parseDownloadJobs(value: unknown): DownloadJob[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BATCH_JOBS) {
    throw new TypeError(`A download batch must contain between 1 and ${MAX_BATCH_JOBS} maps.`);
  }

  const jobs: DownloadJob[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    if (!isRecord(item)) throw new TypeError("A download job is invalid.");
    const beatmapsetId = item["beatmapsetId"];
    const fileName = item["fileName"];
    if (!Number.isSafeInteger(beatmapsetId) || Number(beatmapsetId) <= 0) {
      throw new TypeError("A download job has an invalid beatmapset ID.");
    }
    if (typeof fileName !== "string" || !fileName.trim() || fileName.length > 500) {
      throw new TypeError("A download job has an invalid file name.");
    }
    const id = Number(beatmapsetId);
    if (seen.has(id)) continue;
    seen.add(id);
    jobs.push({ beatmapsetId: id, fileName });
  }
  return jobs;
}

function parseInstalledIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length > MAX_INSTALLED_IDS) {
    throw new TypeError("The installed beatmap list is invalid.");
  }
  const ids = new Set<number>();
  for (const valueId of value) {
    if (!Number.isSafeInteger(valueId) || Number(valueId) <= 0) {
      throw new TypeError("The installed beatmap list contains an invalid ID.");
    }
    ids.add(Number(valueId));
  }
  return [...ids];
}

async function configuredOutputFolder(requested: unknown): Promise<string> {
  const requestedFolder = requiredString(requested, "Output folder");
  const config = await loadConfig();
  const configured = config.outputFolder ?? getDefaultDownloadsFolder();
  if (!samePath(requestedFolder, configured)) throw new TypeError("The output folder is not configured.");
  return configured;
}

async function configuredSongsFolder(requested: unknown): Promise<string> {
  const requestedFolder = requiredString(requested, "Songs folder");
  const configured = (await loadConfig()).songsFolder;
  if (!configured || !samePath(requestedFolder, configured)) {
    throw new TypeError("The Songs folder is not configured.");
  }
  return configured;
}

async function buildAutoImportContext(): Promise<AutoImportContext | null> {
  const config = await loadConfig();
  const songsFolder = config.songsFolder ?? (await findDefaultSongsFolder());
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
  ipcMain.handle("search-beatmapsets", async (_event, input: unknown) => {
    const filters = parseSearchFilters(input);
    if (!filters) return { beatmapsets: [], cursorString: null, error: "Search filters are invalid." };
    const validationError = validateSearchFilters(filters);
    if (validationError) return { beatmapsets: [], cursorString: null, error: validationError };

    activeSearchController?.abort();
    const controller = new AbortController();
    activeSearchController = controller;
    try {
      return await searchBeatmapsets(filters, controller.signal);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        return { beatmapsets: [], cursorString: filters.cursorString ?? null, cancelled: true };
      }
      const message = error instanceof OsuApiError ? error.message : "Search failed unexpectedly.";
      return { beatmapsets: [], cursorString: null, error: message };
    } finally {
      if (activeSearchController === controller) activeSearchController = null;
    }
  });

  ipcMain.handle("cancel-search", () => {
    if (!activeSearchController) return false;
    activeSearchController.abort();
    return true;
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
    const directory = config.outputFolder ?? getDefaultDownloadsFolder();
    await fs.mkdir(directory, { recursive: true });
    if (!config.outputFolder) await saveConfig({ outputFolder: directory });
    return directory;
  });

  ipcMain.handle("get-downloaded-ids", async (_event, requested: unknown) => {
    try {
      return await listDownloadedIds(await configuredOutputFolder(requested));
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

  ipcMain.handle("get-installed-beatmapset-ids", async (_event, requested: unknown) =>
    listInstalledBeatmapsets(await configuredSongsFolder(requested)),
  );

  ipcMain.handle("get-auto-import-enabled", async () => (await loadConfig()).autoImportEnabled);
  ipcMain.handle("set-auto-import-enabled", async (_event, enabled: unknown) => {
    if (typeof enabled !== "boolean") throw new TypeError("Auto-import setting is invalid.");
    await saveConfig({ autoImportEnabled: enabled });
    return enabled;
  });

  ipcMain.handle("has-api-credentials", () => hasApiCredentials());

  ipcMain.handle("set-api-credentials", async (_event, clientIdValue: unknown, clientSecretValue: unknown) => {
    try {
      const clientId = requiredString(clientIdValue, "Client ID", 200).trim();
      const clientSecret = requiredString(clientSecretValue, "Client secret", 500).trim();
      await verifyApiCredentials(clientId, clientSecret);
      await saveConfig({ osuApiClientId: clientId, osuApiClientSecret: clientSecret });
      resetTokenCache();
      return { ok: true } as const;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not validate the API credentials.",
      } as const;
    }
  });

  ipcMain.handle(
    "start-download",
    async (_event, jobsValue: unknown, outDirValue: unknown, forceValue: unknown, installedIdsValue: unknown) => {
      if (activeDownloadController) throw new Error("A download batch is already running.");
      const jobs = parseDownloadJobs(jobsValue);
      const outDir = await configuredOutputFolder(outDirValue);
      if (typeof forceValue !== "boolean") throw new TypeError("Re-download setting is invalid.");
      const installedIds = parseInstalledIds(installedIdsValue);
      const win = getWindow();
      const config = await loadConfig();
      const importContext = config.autoImportEnabled ? await buildAutoImportContext() : null;
      const controller = new AbortController();
      activeDownloadController = controller;

      try {
        await runDownloadQueue({
          jobs,
          outDir,
          force: forceValue,
          installedIds,
          signal: controller.signal,
          onProgress(progress: DownloadProgressEvent) {
            win?.webContents.send("download-progress", progress);
          },
          onImported: importContext
            ? async (filePath) => {
                const result = await runImport(filePath, importContext);
                return result.message || undefined;
              }
            : undefined,
        });
        return { done: true } as const;
      } finally {
        if (activeDownloadController === controller) activeDownloadController = null;
      }
    },
  );

  ipcMain.handle("cancel-download", () => {
    if (!activeDownloadController) return false;
    activeDownloadController.abort();
    return true;
  });

  ipcMain.handle("open-output-folder", async () => {
    const config = await loadConfig();
    const directory = config.outputFolder ?? getDefaultDownloadsFolder();
    await fs.mkdir(directory, { recursive: true });
    return shell.openPath(directory);
  });

  ipcMain.handle("open-songs-folder", async () => {
    const directory = (await loadConfig()).songsFolder;
    return directory ? shell.openPath(directory) : "Songs folder is not configured.";
  });

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
