// Auto-import preference, persisted in the app data directory so the toggle
// survives restarts. A missing or corrupt file simply means "off".
import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

const PREFS_KEY = "autoImportEnabled";

function storePath(): string {
  return path.join(app.getPath("userData"), "app-preferences.json");
}

async function readPrefs(): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export async function getAutoImportEnabled(): Promise<boolean> {
  const prefs = await readPrefs();
  return Boolean(prefs[PREFS_KEY]);
}

export async function setAutoImportEnabled(enabled: boolean): Promise<boolean> {
  const prefs = await readPrefs();
  prefs[PREFS_KEY] = enabled;
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(prefs, null, 2));
  return enabled;
}
