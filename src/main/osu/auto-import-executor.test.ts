import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { LibraryLocation } from "./auto-import-executor";
import {
  executeImportPlan,
  findLazerExecutable,
  findStableExecutable,
  getImportTargets,
  planAutoImport,
  type ProcessProbe,
} from "./auto-import-executor";

describe("getImportTargets", () => {
  it("maps scanned library sources to import targets", () => {
    const locations: LibraryLocation[] = [
      { kind: "stable", path: "E:\\osu!\\Songs" },
      { kind: "lazer", path: "E:\\osu lazer" },
    ];
    expect(getImportTargets(locations)).toEqual([
      { kind: "stable", path: "E:\\osu!\\Songs" },
      { kind: "lazer", path: "E:\\osu lazer" },
    ]);
  });

  it("skips sources whose last scan failed", () => {
    const locations: LibraryLocation[] = [{ kind: "lazer", path: "E:\\broken" }];
    const failed = new Set(["e:\\broken"]);
    expect(getImportTargets(locations, failed)).toEqual([]);
  });
});

describe("find game executables", () => {
  it("returns the first existing lazer osu!.exe candidate", () => {
    const probe: ProcessProbe = {
      existsSync: (candidate) => candidate === "B\\osu!.exe",
    };
    expect(findLazerExecutable(["A\\osu!.exe", "B\\osu!.exe"], probe)).toBe("B\\osu!.exe");
  });

  it("returns the stable osu!.exe candidate when it exists", () => {
    const probe: ProcessProbe = {
      existsSync: (candidate) => candidate === "C:\\Users\\maxi\\AppData\\Local\\osu!\\osu!.exe",
    };
    expect(
      findStableExecutable(
        [
          "C:\\Users\\maxi\\AppData\\Local\\osu!\\osu!.exe",
          "D:\\osu!\\osu!.exe",
        ],
        probe,
      ),
    ).toBe("C:\\Users\\maxi\\AppData\\Local\\osu!\\osu!.exe");
  });

  it("returns null when no candidate exists on disk", () => {
    const probe: ProcessProbe = { existsSync: () => false };
    expect(findLazerExecutable(["A\\osu!.exe"], probe)).toBeNull();
    expect(findStableExecutable(["C:\\osu!\\osu!.exe"], probe)).toBeNull();
  });

  it("discovers stable osu! next to the configured Songs folder", async () => {
    const stablePath = "E:\\osu!\\Songs";
    const stableExecutable = "E:\\osu!\\osu!.exe";
    const probe: ProcessProbe = {
      existsSync: (candidate) => candidate === stableExecutable,
    };

    const plan = await planAutoImport(
      [{ kind: "stable", path: stablePath }],
      ["C:\\dl\\a.osz"],
      "C:\\Users\\maxi\\AppData\\Local",
      probe,
    );

    expect(plan).toEqual({
      strategy: "copy",
      target: { kind: "stable", path: stablePath },
      files: ["C:\\dl\\a.osz"],
      executable: stableExecutable,
    });
  });
});

describe("executeImportPlan", () => {
  it("keeps the downloaded source after silently copying it into Songs", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "beatmap-import-"));
    const downloads = path.join(root, "downloads");
    const songs = path.join(root, "Songs");
    const source = path.join(downloads, "123 Artist - Title.osz");
    const destination = path.join(songs, path.basename(source));

    try {
      await fs.mkdir(downloads);
      await fs.mkdir(songs);
      await fs.writeFile(source, "beatmap data");

      const result = await executeImportPlan({
        strategy: "copy",
        target: { kind: "stable", path: songs },
        files: [source],
        executable: null,
      });

      expect(await fs.readFile(source, "utf8")).toBe("beatmap data");
      expect(await fs.readFile(destination, "utf8")).toBe("beatmap data");
      expect(result).toEqual({ imported: 1, deferred: false, message: "" });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("copies every file into the stable Songs folder", async () => {
    const operations: string[] = [];
    const plan = {
      strategy: "copy" as const,
      target: { kind: "stable" as const, path: "E:\\osu!\\Songs" },
      files: ["C:\\dl\\a.osz", "C:\\dl\\b.osz"],
      executable: null,
    };
    const result = await executeImportPlan(plan, {
      copyFile: async (from) => {
        operations.push(`copy:${from}`);
        return `E:\\osu!\\Songs\\${from.split("\\").pop()}`;
      },
    });
    expect(operations).toEqual([
      "copy:C:\\dl\\a.osz",
      "copy:C:\\dl\\b.osz",
    ]);
    expect(result).toEqual({ imported: 2, deferred: false, message: "" });
  });


  it("falls back to launching stable osu! when copying into Songs fails", async () => {
    const launched: Array<{ executable: string; files: string[] }> = [];
    const plan = {
      strategy: "copy" as const,
      target: { kind: "stable" as const, path: "E:\\osu!\\Songs" },
      files: ["C:\\dl\\a.osz"],
      executable: "C:\\osu!\\osu!.exe",
    };

    const result = await executeImportPlan(plan, {
      copyFile: async () => {
        throw new Error("disk full");
      },
      launch: async (executable, files) => {
        launched.push({ executable, files });
      },
    });

    expect(launched).toEqual([
      { executable: "C:\\osu!\\osu!.exe", files: ["C:\\dl\\a.osz"] },
    ]);
    expect(result).toEqual({ imported: 1, deferred: false, message: "" });
  });

  it("runs osu! with one downloaded file as its argument", async () => {
    const launched: Array<{ executable: string; files: string[] }> = [];
    const plan = {
      strategy: "run" as const,
      target: { kind: "lazer" as const, path: "E:\\osu lazer" },
      files: ["C:\\dl\\a.osz"],
      executable: "C:\\osu!lazer\\osu!.exe",
    };
    const result = await executeImportPlan(plan, {
      launch: async (executable, files) => {
        launched.push({ executable, files });
      },
    });
    expect(launched).toEqual([
      { executable: "C:\\osu!lazer\\osu!.exe", files: ["C:\\dl\\a.osz"] },
    ]);
    expect(result).toEqual({ imported: 1, deferred: false, message: "" });
  });

  it("launches each completed file independently instead of re-importing earlier files", async () => {
    const launched: string[][] = [];
    const plan = {
      strategy: "run" as const,
      target: { kind: "lazer" as const, path: "E:\\osu lazer" },
      files: ["C:\\dl\\a.osz", "C:\\dl\\b.osz"],
      executable: "C:\\osu!lazer\\osu!.exe",
    };
    const result = await executeImportPlan(plan, {
      launch: async (_executable, files) => {
        launched.push(files);
      },
    });

    expect(launched).toEqual([["C:\\dl\\a.osz"], ["C:\\dl\\b.osz"]]);
    expect(result.imported).toBe(2);
  });

  it("reports a clear error when osu! cannot be started", async () => {
    const plan = {
      strategy: "run" as const,
      target: { kind: "stable" as const, path: "E:\\osu!\\Songs" },
      files: ["C:\\dl\\a.osz"],
      executable: "C:\\osu!\\osu!.exe",
    };
    const result = await executeImportPlan(plan, {
      launch: async () => {
        throw new Error("spawn ENOENT");
      },
    });

    expect(result.imported).toBe(0);
    expect(result.deferred).toBe(true);
    expect(result.message).toBe(
      "Could not start osu! to import these maps: spawn ENOENT",
    );
  });

  it("reports missing-executable deferral without touching files", async () => {
    const plan = {
      strategy: "deferred" as const,
      target: { kind: "lazer" as const, path: "E:\\osu lazer" },
      files: [],
      executable: null,
    };
    const result = await executeImportPlan(plan, {});
    expect(result).toEqual({
      imported: 0,
      deferred: true,
      message: "Could not find an osu! executable to import these maps.",
    });
  });

  it("counts per-file copy failures instead of failing the whole batch", async () => {
    const plan = {
      strategy: "copy" as const,
      target: { kind: "stable" as const, path: "E:\\osu!\\Songs" },
      files: ["C:\\dl\\good.osz", "C:\\dl\\bad.osz"],
      executable: null,
    };
    const result = await executeImportPlan(plan, {
      copyFile: async (from) => {
        if (from.endsWith("bad.osz")) throw new Error("disk full");
        return "E:\\osu!\\Songs\\good.osz";
      },

    });
    expect(result.imported).toBe(1);
    expect(result.message).toMatch(/1 .*failed/i);
  });
});
