import { describe, expect, it } from "vitest";
import {
  buildImportPlan,
  importPlanForFile,
  type ImportTarget,
} from "./auto-import";

const stableTarget: ImportTarget = {
  kind: "stable",
  path: "E:\\osu!\\Songs",
};
const lazerTarget: ImportTarget = {
  kind: "lazer",
  path: "E:\\osu lazer",
};
const lazerExecutable = "C:\\Users\\maxi\\AppData\\Local\\osulazer\\current\\osu!.exe";
const stableExecutable = "C:\\Users\\maxi\\AppData\\Local\\osu!\\osu!.exe";

const files = ["C:\\dl\\1.osz", "C:\\dl\\2.osz"];

describe("buildImportPlan", () => {
  it("returns a copy plan for stable libraries only when neither game executable exists", () => {
    const plan = buildImportPlan([stableTarget], files, null, null);
    expect(plan).toEqual({
      strategy: "copy",
      target: stableTarget,
      files,
      executable: null,
    });
  });

  it("prefers copying into stable Songs even when the stable executable exists", () => {
    const plan = buildImportPlan([stableTarget], [files[0]], null, stableExecutable);
    expect(plan).toEqual({
      strategy: "copy",
      target: stableTarget,
      files: [files[0]],
      executable: stableExecutable,
    });
  });

  it("never selects the lazer executable for stable-only targets", () => {
    const plan = buildImportPlan([stableTarget], [files[0]], lazerExecutable, null);
    expect(plan).toEqual({
      strategy: "copy",
      target: stableTarget,
      files: [files[0]],
      executable: null,
    });
  });

  it("prefers stable Songs copy whenever a stable target exists", () => {
    const plan = buildImportPlan(
      [stableTarget, lazerTarget],
      [files[0]],
      lazerExecutable,
      stableExecutable,
    );
    expect(plan).toEqual({
      strategy: "copy",
      target: stableTarget,
      files: [files[0]],
      executable: stableExecutable,
    });
  });

  it("copies to stable Songs when lazer has no executable and keeps stable as fallback", () => {
    const plan = buildImportPlan(
      [stableTarget, lazerTarget],
      [files[0]],
      null,
      stableExecutable,
    );
    expect(plan).toEqual({
      strategy: "copy",
      target: stableTarget,
      files: [files[0]],
      executable: stableExecutable,
    });
  });

  it("keeps the run strategy for a lazer library with an executable", () => {
    const plan = buildImportPlan([lazerTarget], [files[0]], lazerExecutable, null);
    expect(plan.strategy).toBe("run");
    expect(plan.executable).toBe(lazerExecutable);
  });

  it("does not use the stable executable for lazer-only targets", () => {
    const plan = buildImportPlan([lazerTarget], [files[0]], null, stableExecutable);
    expect(plan).toEqual({
      strategy: "deferred",
      target: lazerTarget,
      files: [],
      executable: null,
    });
  });

  it("uses stable Songs copy only when no executable exists", () => {
    const plan = buildImportPlan([stableTarget, lazerTarget], [files[0]], null, null);
    expect(plan.strategy).toBe("copy");
    expect(plan.target?.kind).toBe("stable");
  });

  it("defers only when a lazer library has no executable and no stable fallback", () => {
    const plan = buildImportPlan([lazerTarget], [files[0]], null, null);
    expect(plan).toEqual({
      strategy: "deferred",
      target: lazerTarget,
      files: [],
      executable: null,
    });
  });

  it("selects a strategy even when the initial plan has no files", () => {
    const plan = buildImportPlan([lazerTarget], [], lazerExecutable, null);
    expect(plan).toEqual({
      strategy: "run",
      target: lazerTarget,
      files: [],
      executable: lazerExecutable,
    });
  });

  it("creates an independent plan for each completed download", () => {
    const base = buildImportPlan([lazerTarget], [], lazerExecutable, null);
    const first = importPlanForFile(base, files[0]);
    const second = importPlanForFile(base, files[1]);

    expect(first.files).toEqual([files[0]]);
    expect(second.files).toEqual([files[1]]);
  });

  it("returns an empty plan when there are no import targets", () => {
    expect(buildImportPlan([], files, null, null)).toEqual({
      strategy: "none",
      target: null,
      files: [],
      executable: null,
    });
  });
});
