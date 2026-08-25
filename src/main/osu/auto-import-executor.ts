import { copyFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { existsSync as fileExists } from "node:fs";
import path from "node:path";
import type { LibraryKind } from "@shared/types";
import {
  buildImportPlan,
  type ImportPlan,
  type ImportTarget,
} from "./auto-import";

/** A scanned library source that could receive imports. */
export interface LibraryLocation {
  kind: LibraryKind;
  path: string;
}

export interface ProcessProbe {
  existsSync(path: string): boolean;
  /** Retained for callers that provide the old probe shape; it is not used. */
  isOsuRunning?: () => boolean;
}

export interface ImportExecutorDeps {
  copyFile?: (from: string, to: string) => Promise<string>;
  removeFile?: (file: string) => Promise<void>;
  launch?: (executable: string, files: string[]) => Promise<void>;
}

export interface ImportOutcome {
  imported: number;
  deferred: boolean;
  message: string;
}

/** Library sources that can receive imports; failed scans are skipped. */
export function getImportTargets(
  locations: LibraryLocation[],
  failedPaths: Set<string> = new Set(),
): ImportTarget[] {
  return locations
    .filter((location) => !failedPaths.has(location.path.toLowerCase()))
    .map((location) => ({ kind: location.kind, path: location.path }));
}

function findExistingExecutable(candidates: string[], probe: ProcessProbe): string | null {
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

/** Finds the first existing osu!lazer executable candidate. */
export function findLazerExecutable(
  candidates: string[],
  probe: ProcessProbe = { existsSync: fileExists },
): string | null {
  return findExistingExecutable(candidates, probe);
}

/** Finds the first existing osu!stable executable candidate. */
export function findStableExecutable(
  candidates: string[],
  probe: ProcessProbe = { existsSync: fileExists },
): string | null {
  return findExistingExecutable(candidates, probe);
}

/** Where an osu!lazer install keeps its executable, most likely first. */
export function defaultLazerCandidates(localAppData: string | undefined): string[] {
  if (!localAppData) return [];
  const root = path.join(localAppData, "osulazer");
  return [
    path.join(root, "current", "osu!.exe"),
    path.join(root, "osu!.exe"),
    path.join(root, "app-current", "osu!.exe"),
    path.join(root, "latest", "osu!.exe"),
  ];
}

function defaultStableCandidates(
  localAppData: string | undefined,
  targets: ImportTarget[],
): string[] {
  const configuredCandidates = targets
    .filter((target) => target.kind === "stable")
    .map((target) => path.join(path.dirname(target.path), "osu!.exe"));
  const defaultCandidates = localAppData
    ? [path.join(localAppData, "osu!", "osu!.exe")]
    : [];
  return [...configuredCandidates, ...defaultCandidates];
}

export async function planAutoImport(
  locations: LibraryLocation[],
  files: string[],
  localAppData: string | undefined,
  probe?: ProcessProbe,
): Promise<ImportPlan> {
  const targets = getImportTargets(locations);
  const effectiveProbe: ProcessProbe = probe ?? { existsSync: fileExists };
  const hasLazerTarget = targets.some((target) => target.kind === "lazer");
  const hasStableTarget = targets.some((target) => target.kind === "stable");
  const lazerExecutable = hasLazerTarget
    ? findLazerExecutable(defaultLazerCandidates(localAppData), effectiveProbe)
    : null;
  const stableExecutable = hasStableTarget
    ? findStableExecutable(defaultStableCandidates(localAppData, targets), effectiveProbe)
    : null;
  return buildImportPlan(targets, files, lazerExecutable, stableExecutable);
}

async function defaultCopy(from: string, to: string): Promise<string> {
  await copyFile(from, to);
  return to;
}

/**
 * Starts osu! without waiting for the game process to exit. The spawn event
 * confirms that Windows accepted the executable; an error before that is
 * surfaced to the caller as a useful import failure.
 */
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

/**
 * Carries out an import plan. Each run strategy invocation receives exactly
 * one .osz argument, so a batch can never re-submit an earlier completed file.
 */
export async function executeImportPlan(
  plan: ImportPlan,
  deps: ImportExecutorDeps = {},
): Promise<ImportOutcome> {
  const copy = deps.copyFile ?? defaultCopy;
  const remove = deps.removeFile ?? unlink;
  const launch = deps.launch ?? defaultLaunch;

  switch (plan.strategy) {
    case "none":
      return { imported: 0, deferred: false, message: "" };

    case "deferred":
      return {
        imported: 0,
        deferred: true,
        message: "Could not find an osu! executable to import these maps.",
      };

    case "copy": {
      let imported = 0;
      let failed = 0;
      let cleanupFailed = 0;
      for (const file of plan.files) {
        const destination = path.join(plan.target!.path, path.basename(file));
        if (path.resolve(file).toLowerCase() === path.resolve(destination).toLowerCase()) {
          // The output folder already is Songs, so there is nothing to move.
          imported += 1;
          continue;
        }

        try {
          await copy(file, destination);
        } catch {
          // Copy did not land. Keep the source and ask stable to import it as
          // the fallback; never remove a file before a destination exists.
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
          continue;
        }

        imported += 1;
        try {
          await remove(file);
        } catch {
          // The map is already safely present in Songs. Report the leftover
          // source instead of launching osu! and importing the same map twice.
          cleanupFailed += 1;
        }
      }

      const messages: string[] = [];
      if (failed > 0) {
        messages.push(`${failed} file${failed === 1 ? "" : "s"} failed to import.`);
      }
      if (cleanupFailed > 0) {
        messages.push(
          `${cleanupFailed} original file${cleanupFailed === 1 ? " was" : "s were"} copied but could not be removed.`
        );
      }
      return { imported, deferred: false, message: messages.join(" ") };
    }

    case "run": {
      if (!plan.executable) {
        return {
          imported: 0,
          deferred: true,
          message: "Could not start osu! to import these maps: no executable was selected.",
        };
      }

      let imported = 0;
      for (const file of plan.files) {
        try {
          await launch(plan.executable, [file]);
          imported += 1;
        } catch (error) {
          return {
            imported,
            deferred: true,
            message: `Could not start osu! to import these maps: ${
              error instanceof Error ? error.message : String(error)
            }`,
          };
        }
      }
      return { imported, deferred: false, message: "" };
    }
  }
}
