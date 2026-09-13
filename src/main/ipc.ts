import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DownloadJob, DownloadProgressEvent, OsuFolderSelection } from "@shared/types";
import { parseSearchFilters, validateSearchFilters } from "@shared/search-filters";
import { MAX_LINK_TEXT_LENGTH, parseBeatmapLinks } from "@shared/beatmap-links";
import {
  hasApiCredentials,
  lookupBeatmaps,
  lookupBeatmapsetName,
  OsuApiError,
  resetTokenCache,
  searchBeatmapsets,
  verifyApiCredentials,
} from "./osu/api";
import { resolveBeatmapLinks } from "./osu/resolve-links";
import {
  listInstalledBeatmapsets,
  resolveOsuFolder,
} from "./osu/songs-folder";
import { executeImportPlan, planAutoImport, type ImportOutcome } from "./osu/auto-import-executor";
import { importPlanForFile } from "./osu/auto-import";
import { runDownloadQueue } from "./download/queue";
import { listDownloadedIds, listDownloadHistory } from "./download/manifest";
import { getDefaultDownloadsFolder, loadConfig, saveConfig } from "./config";
import { isRecord } from "./json-file";
import { getCredentials, getCredentialSettings, storeCredentials, forgetCredentials } from "./credentials";
import { loadOsuFolderSelection, getOsuFolderSettings, setOsuFolderSettings, setOsuFolderSelection } from "./osu/folder-settings";

const MAX_INSTALLED_IDS = 2_000_000;

let activeSearchController: AbortController | null = null;
let activeDownloadController: AbortController | null = null;
let activeLinkController: AbortController | null = null;

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
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("A download batch must contain at least one map.");
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

async function configuredOsuFolders(
  requestedOsuFolder: unknown,
  requestedSongsFolder: unknown,
): Promise<OsuFolderSelection> {
  const osuFolder = requiredString(requestedOsuFolder, "osu! folder");
  const songsFolder = requiredString(requestedSongsFolder, "Songs folder");
  const configured = await loadOsuFolderSelection();
  if (
    !configured ||
    !samePath(osuFolder, configured.osuFolder) ||
    !samePath(songsFolder, configured.songsFolder)
  ) {
    throw new TypeError("The osu! folder is not configured.");
  }
  return configured;
}

async function buildAutoImportContext(): Promise<AutoImportContext | null> {
  const selection = await loadOsuFolderSelection();
  if (!selection) return null;

  const planPromise = planAutoImport(
    selection.songsFolder,
    [],
    process.env.LOCALAPPDATA,
    selection.osuFolder,
  );
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
    if (activeDownloadController) throw new Error("Wait for the current download batch to finish.");
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;
    // The queue captured the old folder at start, so a batch that began while
    // the picker was open would keep writing there.
    if (activeDownloadController) throw new Error("Wait for the current download batch to finish.");
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

  ipcMain.handle("get-osu-folder", () => loadOsuFolderSelection());
  ipcMain.handle("get-osu-folder-settings", () => getOsuFolderSettings());
  ipcMain.handle("set-osu-folder-settings", async (_event, value: unknown) => {
    if (activeDownloadController) throw new Error("Wait for the current download batch to finish.");
    if (!isRecord(value) || typeof value.remember !== "boolean" || typeof value.autoDetect !== "boolean") throw new Error("Folder preferences are invalid.");
    return setOsuFolderSettings({ remember: value.remember, autoDetect: value.autoDetect });
  });

  ipcMain.handle("choose-osu-folder", async () => {
    if (activeDownloadController) throw new Error("Wait for the current download batch to finish.");
    const win = getWindow();
    if (!win) return null;
    const current = await loadOsuFolderSelection();
    const result = await dialog.showOpenDialog(win, {
      title: "Choose your osu! installation folder",
      buttonLabel: "Select osu! folder",
      defaultPath: current?.osuFolder,
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const selection = await resolveOsuFolder(result.filePaths[0]);
    if (activeDownloadController) throw new Error("Wait for the current download batch to finish.");
    await setOsuFolderSelection(selection);
    return selection;
  });

  ipcMain.handle(
    "get-installed-beatmapset-ids",
    async (_event, requestedOsuFolder: unknown, requestedSongsFolder: unknown) => {
      const selection = await configuredOsuFolders(requestedOsuFolder, requestedSongsFolder);
      return listInstalledBeatmapsets(selection.songsFolder, selection.osuFolder);
    },
  );

  ipcMain.handle("get-auto-import-enabled", async () => (await loadConfig()).autoImportEnabled);
  ipcMain.handle("set-auto-import-enabled", async (_event, enabled: unknown) => {
    if (typeof enabled !== "boolean") throw new TypeError("Auto-import setting is invalid.");
    await saveConfig({ autoImportEnabled: enabled });
    return enabled;
  });

  ipcMain.handle("has-api-credentials", () => hasApiCredentials());
  ipcMain.handle("get-credential-settings", () => getCredentialSettings());
  ipcMain.handle("forget-api-credentials", async () => { await forgetCredentials(); resetTokenCache(); });
  ipcMain.handle("get-search-presets", async () => (await loadConfig()).searchPresets);
  ipcMain.handle("save-search-presets", async (_event, input: unknown) => {
    if (!Array.isArray(input) || input.length > 50) throw new Error("You can save up to 50 presets.");
    for (const preset of input) {
      if (!isRecord(preset) || typeof preset.name !== "string" || !preset.name.trim() || preset.name.length > 80) throw new Error("Preset name is invalid.");
      const filters = parseSearchFilters(preset.filters);
      if (!filters || validateSearchFilters(filters)) throw new Error("Preset filters are invalid.");
    }
    return (await saveConfig({ searchPresets: input })).searchPresets;
  });
  ipcMain.handle("get-download-history", async () => {
    const config = await loadConfig();
    return listDownloadHistory(config.outputFolder ?? getDefaultDownloadsFolder());
  });
  ipcMain.handle("reveal-download", async (_event, id: unknown) => {
    if (!Number.isSafeInteger(id)) throw new Error("Invalid beatmap ID.");
    const config = await loadConfig();
    const entry = (await listDownloadHistory(config.outputFolder ?? getDefaultDownloadsFolder())).find((entry) => entry.beatmapsetId === id);
    if (!entry?.exists) throw new Error("The downloaded file is no longer in the output folder.");
    shell.showItemInFolder(entry.path);
  });
  ipcMain.handle("export-failed-ids", async (_event, values: unknown) => {
    const ids = parseInstalledIds(values);
    const win = getWindow();
    if (!win) return false;
    const result = await dialog.showSaveDialog(win, { title: "Export unfinished beatmap IDs", defaultPath: "unfinished-beatmaps.txt", filters: [{ name: "Text", extensions: ["txt"] }] });
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(result.filePath, ids.join("\n") + "\n", "utf8");
    return true;
  });

  ipcMain.handle("resolve-beatmap-links", async (_event, text: unknown) => {
    if (typeof text !== "string" || text.length > MAX_LINK_TEXT_LENGTH) throw new TypeError("The pasted links are invalid.");
    activeLinkController?.abort();
    const controller = new AbortController();
    activeLinkController = controller;
    try {
      return await resolveBeatmapLinks(parseBeatmapLinks(text).refs, { lookupBeatmaps, lookupBeatmapsetName }, controller.signal);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return { jobs: [], problems: [], cancelled: true };
      throw error;
    } finally {
      if (activeLinkController === controller) activeLinkController = null;
    }
  });

  ipcMain.handle("cancel-link-lookup", () => {
    if (!activeLinkController) return false;
    activeLinkController.abort();
    return true;
  });

  ipcMain.handle("set-api-credentials", async (_event, clientIdValue: unknown, clientSecretValue: unknown, remember: unknown) => {
    try {
      if (typeof remember !== "boolean") throw new Error("Choose whether to remember credentials.");
      const clientId = requiredString(clientIdValue, "Client ID", 200).trim();
      let clientSecret = typeof clientSecretValue === "string" ? clientSecretValue.trim() : "";
      if (!clientSecret) {
        const current = await getCredentials();
        if (current.clientId === clientId) clientSecret = current.clientSecret;
      }
      requiredString(clientSecret, "Client secret", 500);
      await verifyApiCredentials(clientId, clientSecret);
      await storeCredentials(clientId, clientSecret, remember);
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

  ipcMain.handle("open-osu-folder", async () => {
    const selection = await loadOsuFolderSelection();
    return selection ? shell.openPath(selection.osuFolder) : "osu! folder is not configured.";
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
