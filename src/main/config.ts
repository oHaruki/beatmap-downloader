// Persistent settings, kept next to the exe when packaged (portable, travels
// with the folder) or in the project root in dev. Not app.getPath('userData'),
// since that ties data to a Windows profile instead of the app's own folder.
import { app } from "electron";
import { promises as fs } from "fs";
import path from "path";

export interface AppConfig {
  outputFolder: string | null;
  songsFolder: string | null;
  osuApiClientId: string | null;
  osuApiClientSecret: string | null;
}

const DEFAULT_CONFIG: AppConfig = {
  outputFolder: null,
  songsFolder: null,
  osuApiClientId: null,
  osuApiClientSecret: null,
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

export async function loadConfig(): Promise<AppConfig> {
  if (cache) return cache;
  let loaded: AppConfig;
  try {
    const raw = await fs.readFile(configFilePath(), "utf-8");
    loaded = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    loaded = { ...DEFAULT_CONFIG };
  }
  cache = loaded;
  return loaded;
}

export async function saveConfig(partial: Partial<AppConfig>): Promise<AppConfig> {
  const current = await loadConfig();
  cache = { ...current, ...partial };
  await fs.writeFile(configFilePath(), JSON.stringify(cache, null, 2), "utf-8");
  return cache;
}
