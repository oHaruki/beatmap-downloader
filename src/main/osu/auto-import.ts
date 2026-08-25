// Import-on-download planning for osu!stable. A completed .osz is copied
// silently into Songs; osu!.exe is retained only as a copy-failure fallback.

export type ImportStrategy = "copy" | "none";

export interface ImportPlan {
  strategy: ImportStrategy;
  songsFolder: string | null;
  files: string[];
  executable: string | null;
}

export function buildImportPlan(
  songsFolder: string | null,
  files: string[],
  stableExecutable: string | null,
): ImportPlan {
  if (!songsFolder) {
    return { strategy: "none", songsFolder: null, files: [], executable: null };
  }

  return {
    strategy: "copy",
    songsFolder,
    files,
    executable: stableExecutable,
  };
}

/** Make an import plan for exactly one completed download. */
export function importPlanForFile(plan: ImportPlan, file: string): ImportPlan {
  return { ...plan, files: [file] };
}
