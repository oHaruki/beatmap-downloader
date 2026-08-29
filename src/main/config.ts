// Persistent settings, kept next to the exe when packaged (portable, travels
// with the folder) or in the project root in dev. Not app.getPath('userData'),
// since that ties data to a Windows profile instead of the app's own folder.
import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { displayPath, isMissingFile, isRecord, writeJsonAtomic } from "./json-file";

export interface AppConfig {
  outputFolder: string | null;
  osuFolder: string | null;
  songsFolder: string | null;
  osuApiClientId: string | null;
  osuApiClientSecret: string | null;
  autoImportEnabled: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  outputFolder: null,
  osuFolder: null,
  songsFolder: null,
  osuApiClientId: null,
  osuApiClientSecret: null,
  autoImportEnabled: false,
};

function configDir(): string {
  return app.isPackaged ? path.dirname(app.getPath("exe")) : process.cwd();
}

function configFilePath(): string {
  return path.join(configDir(), "config.json");
}

export function getDefaultDownloadsFolder(): string {
  return path.join(configDir(), "downloads");
}

let cache: AppConfig | null = null;
let loading: Promise<AppConfig> | null = null;
let pendingSave = Promise.resolve();

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function parseAppConfig(value: unknown): AppConfig {
  if (!isRecord(value)) return { ...DEFAULT_CONFIG };
  return {
    outputFolder: nullableString(value["outputFolder"]),
    osuFolder: nullableString(value["osuFolder"]),
    songsFolder: nullableString(value["songsFolder"]),
    osuApiClientId: nullableString(value["osuApiClientId"]),
    osuApiClientSecret: nullableString(value["osuApiClientSecret"]),
    autoImportEnabled:
      typeof value["autoImportEnabled"] === "boolean"
        ? value["autoImportEnabled"]
        : DEFAULT_CONFIG.autoImportEnabled,
  };
}

async function readConfig(): Promise<AppConfig> {
  const filePath = configFilePath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return parseAppConfig(JSON.parse(raw));
  } catch (error) {
    if (!isMissingFile(error)) {
      console.warn(`[config] could not read ${displayPath(filePath)}; using defaults`);
    }
    return { ...DEFAULT_CONFIG };
  }
}

export async function loadConfig(): Promise<AppConfig> {
  if (cache) return cache;
  loading ??= readConfig();
  try {
    cache = await loading;
    return cache;
  } finally {
    loading = null;
  }
}

export function saveConfig(partial: Partial<AppConfig>): Promise<AppConfig> {
  const operation = pendingSave.then(async () => {
    const next = parseAppConfig({ ...(await loadConfig()), ...partial });
    await writeJsonAtomic(configFilePath(), next);
    cache = next;
    return next;
  });
  pendingSave = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}
