// Import-on-download planning. osu!stable can import silently when a .osz is
// copied into its Songs folder, while osu!lazer has no importable folder and
// must still receive files through an executable launch.
import type { LibraryKind } from "@shared/types";

export interface ImportTarget {
  kind: LibraryKind;
  path: string;
}

export type ImportStrategy = "copy" | "run" | "deferred" | "none";

export interface ImportPlan {
  strategy: ImportStrategy;
  target: ImportTarget | null;
  /** Files the strategy will act on; empty for "deferred" and "none". */
  files: string[];
  /** Game executable to run as a copy fallback, or null when unavailable. */
  executable: string | null;
}

export function findLazerExecutable(searchPaths: string[]): string | null {
  return searchPaths.find((candidate) => candidate.toLowerCase().endsWith("osu!.exe")) ?? null;
}

export function buildImportPlan(
  targets: ImportTarget[],
  files: string[],
  lazerExecutable: string | null,
  stableExecutable: string | null,
): ImportPlan {
  if (targets.length === 0) {
    return { strategy: "none", target: null, files: [], executable: null };
  }

  const stableTarget = targets.find((target) => target.kind === "stable") ?? null;
  const lazerTarget = targets.find((target) => target.kind === "lazer") ?? null;

  // A stable Songs folder is the silent primary strategy. Keep the stable
  // executable on the plan so execution can fall back if the copy fails.
  if (stableTarget) {
    return {
      strategy: "copy",
      target: stableTarget,
      files,
      executable: stableExecutable,
    };
  }

  // Lazer has no import folder we can copy into, so launch its executable.
  if (lazerTarget && lazerExecutable) {
    return {
      strategy: "run",
      target: lazerTarget,
      files,
      executable: lazerExecutable,
    };
  }

  // A stable-only plan must never hand its files to lazer, and a lazer plan
  // without an executable has no local import fallback.
  return { strategy: "deferred", target: lazerTarget, files: [], executable: null };
}

/** Make an import plan for exactly one completed download. */
export function importPlanForFile(plan: ImportPlan, file: string): ImportPlan {
  return { ...plan, files: [file] };
}
