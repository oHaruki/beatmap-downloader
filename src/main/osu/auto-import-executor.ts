import { copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { existsSync as fileExists } from "node:fs";
import path from "node:path";
import { buildImportPlan, type ImportPlan } from "./auto-import";

export interface ProcessProbe {
  existsSync(path: string): boolean;
}

export interface ImportExecutorDeps {
  copyFile?: (from: string, to: string) => Promise<string>;
  launch?: (executable: string, files: string[]) => Promise<void>;
}

export interface ImportOutcome {
  imported: number;
  deferred: boolean;
  message: string;
}

/** Finds the first existing osu!stable executable candidate. */
export function findStableExecutable(
  candidates: string[],
  probe: ProcessProbe = { existsSync: fileExists },
): string | null {
  for (const candidate of candidates) {
    try {
      if (candidate.toLowerCase().endsWith("osu!.exe") && probe.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Unreadable path: keep looking.
    }
  }
  return null;
}

function defaultStableCandidates(
  localAppData: string | undefined,
  songsFolder: string,
): string[] {
  const configuredCandidate = path.join(path.dirname(songsFolder), "osu!.exe");
  const defaultCandidates = localAppData
    ? [path.join(localAppData, "osu!", "osu!.exe")]
    : [];
  return [configuredCandidate, ...defaultCandidates];
}

export async function planAutoImport(
  songsFolder: string,
  files: string[],
  localAppData: string | undefined,
  probe: ProcessProbe = { existsSync: fileExists },
): Promise<ImportPlan> {
  const stableExecutable = findStableExecutable(
    defaultStableCandidates(localAppData, songsFolder),
    probe,
  );
  return buildImportPlan(songsFolder, files, stableExecutable);
}

async function defaultCopy(from: string, to: string): Promise<string> {
  await copyFile(from, to);
  return to;
}

/** Starts osu!stable without waiting for the game process to exit. */
async function defaultLaunch(executable: string, files: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const child = spawn(executable, files, {
      windowsHide: true,
      stdio: "ignore",
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.once("spawn", () => {
      if (settled) return;
      settled = true;
      resolve();
    });
  });
}

/** Copy completed downloads into Songs, with osu!stable as the fallback. */
export async function executeImportPlan(
  plan: ImportPlan,
  deps: ImportExecutorDeps = {},
): Promise<ImportOutcome> {
  if (plan.strategy === "none" || !plan.songsFolder) {
    return { imported: 0, deferred: false, message: "" };
  }

  const copy = deps.copyFile ?? defaultCopy;
  const launch = deps.launch ?? defaultLaunch;
  let imported = 0;
  let failed = 0;

  for (const file of plan.files) {
    try {
      await copy(file, path.join(plan.songsFolder, path.basename(file)));
      imported += 1;
    } catch {
      if (!plan.executable) {
        failed += 1;
        continue;
      }

      try {
        await launch(plan.executable, [file]);
        imported += 1;
      } catch {
        failed += 1;
      }
    }
  }

  const message = failed > 0 ? `${failed} file${failed === 1 ? "" : "s"} failed to import.` : "";
  return { imported, deferred: false, message };
}
