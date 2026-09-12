import { app, safeStorage } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadConfig, saveConfig } from "./config";
import { isMissingFile, writeJsonAtomic } from "./json-file";
import type { CredentialSettings } from "../shared/types";

interface Credentials { clientId: string; clientSecret: string; remember: boolean }
let session: Credentials | undefined;

function credentialPath(): string {
  return path.join(app.getPath("appData"), "beatmap-downloader", "credentials.json");
}

export async function getCredentials(): Promise<Credentials> {
  if (session) return session;
  try {
    const saved = JSON.parse(await fs.readFile(credentialPath(), "utf8"));
    const value = JSON.parse(safeStorage.decryptString(Buffer.from(saved.encrypted, "base64")));
    if (typeof value.clientId !== "string" || typeof value.clientSecret !== "string") throw new Error();
    return session = { ...value, remember: true };
  } catch (error) {
    if (!isMissingFile(error)) throw new Error("Saved credentials could not be read. Replace them in Settings or use Forget saved credentials.");
  }
  // Existing portable settings and .env remain usable until the user changes them.
  const config = await loadConfig();
  return session = {
    clientId: config.osuApiClientId || process.env.OSU_API_CLIENT_ID || "",
    clientSecret: config.osuApiClientSecret || process.env.OSU_API_CLIENT_SECRET || "",
    remember: false,
  };
}

export async function getCredentialSettings(): Promise<CredentialSettings> {
  const value = await getCredentials();
  return { clientId: value.clientId, hasSecret: Boolean(value.clientSecret), remember: value.remember };
}

export async function storeCredentials(clientId: string, clientSecret: string, remember: boolean): Promise<void> {
  if (remember) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows credential protection is unavailable. Uncheck Remember to use credentials for this session.");
    const encrypted = safeStorage.encryptString(JSON.stringify({ clientId, clientSecret })).toString("base64");
    await fs.mkdir(path.dirname(credentialPath()), { recursive: true });
    await writeJsonAtomic(credentialPath(), { encrypted });
  } else {
    await fs.rm(credentialPath(), { force: true });
  }
  await saveConfig({ osuApiClientId: null, osuApiClientSecret: null });
  session = { clientId, clientSecret, remember };
}

export async function forgetCredentials(): Promise<void> {
  await fs.rm(credentialPath(), { force: true });
  await saveConfig({ osuApiClientId: null, osuApiClientSecret: null });
  session = { clientId: "", clientSecret: "", remember: false };
}
