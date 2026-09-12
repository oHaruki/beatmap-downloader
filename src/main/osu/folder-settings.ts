import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { OsuFolderSelection, OsuFolderSettings } from "../../shared/types";
import { isMissingFile, isRecord, writeJsonAtomic } from "../json-file";
import { findDefaultOsuFolder, resolveOsuFolder } from "./songs-folder";

let settings: OsuFolderSettings = { remember: false, autoDetect: false };
let selection: OsuFolderSelection | null = null;
let initialized: Promise<void> | undefined;

function settingsPath(): string {
  return path.join(app.getPath("appData"), "beatmap-downloader", "folders.json");
}

async function persist(): Promise<void> {
  if (!settings.remember && !settings.autoDetect) {
    await fs.rm(settingsPath(), { force: true });
    return;
  }
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await writeJsonAtomic(settingsPath(), {
    ...settings,
    ...(settings.remember && selection ? { osuFolder: selection.osuFolder } : {}),
  });
}

async function initialize(): Promise<void> {
  let saved: unknown;
  try { saved = JSON.parse(await fs.readFile(settingsPath(), "utf8")); }
  catch (error) {
    if (!isMissingFile(error)) console.warn("[folders] Could not read folder preferences; automatic detection is disabled.");
    return;
  }
  if (!isRecord(saved)) return;
  settings = { remember: saved.remember === true, autoDetect: saved.autoDetect === true };
  if (settings.remember && typeof saved.osuFolder === "string") {
    try { selection = await resolveOsuFolder(saved.osuFolder); }
    catch { /* A moved or removed install can be rediscovered if enabled. */ }
  }
  if (!selection && settings.autoDetect) {
    selection = await findDefaultOsuFolder();
    if (selection && settings.remember) await persist();
  }
}

async function ready(): Promise<void> {
  initialized ??= initialize();
  await initialized;
}

export async function loadOsuFolderSelection(): Promise<OsuFolderSelection | null> {
  await ready();
  return selection;
}

export async function getOsuFolderSettings(): Promise<OsuFolderSettings> {
  await ready();
  return { ...settings };
}

export async function setOsuFolderSelection(next: OsuFolderSelection): Promise<void> {
  await ready();
  const previous = selection;
  selection = next;
  try { await persist(); }
  catch (error) { selection = previous; throw error; }
}

export async function setOsuFolderSettings(next: OsuFolderSettings): Promise<OsuFolderSelection | null> {
  await ready();
  const previous = settings;
  const previousSelection = selection;
  settings = { ...next };
  try {
    if (!selection && settings.autoDetect) selection = await findDefaultOsuFolder();
    await persist();
  } catch (error) {
    settings = previous;
    selection = previousSelection;
    throw error;
  }
  return selection;
}
