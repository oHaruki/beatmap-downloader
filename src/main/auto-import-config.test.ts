import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The preference store lives in Electron's userData directory; point
// app.getPath at a throwaway directory for each test.
let prefsDir: string;

vi.mock("electron", () => ({
  app: {
    getPath: (_name: string) => prefsDir,
  },
}));

import {
  getAutoImportEnabled,
  setAutoImportEnabled,
} from "./auto-import-config";

function storePath(): string {
  return path.join(prefsDir, "app-preferences.json");
}

beforeEach(async () => {
  prefsDir = await mkdtemp(path.join(tmpdir(), "auto-import-config-"));
});

describe("auto-import preference", () => {
  it("defaults to disabled when no preference file exists", async () => {
    expect(await getAutoImportEnabled()).toBe(false);
  });

  it("persists the enabled state and reads it back", async () => {
    expect(await setAutoImportEnabled(true)).toBe(true);
    expect(await getAutoImportEnabled()).toBe(true);

    expect(await setAutoImportEnabled(false)).toBe(false);
    expect(await getAutoImportEnabled()).toBe(false);
  });

  it("writes the flag into app-preferences.json without clobbering other keys", async () => {
    await writeFile(storePath(), JSON.stringify({ outputFolder: "D:\\dl" }, null, 2));

    await setAutoImportEnabled(true);

    const stored = JSON.parse(await readFile(storePath(), "utf8")) as Record<string, unknown>;
    expect(stored.autoImportEnabled).toBe(true);
    expect(stored.outputFolder).toBe("D:\\dl");
  });

  it("treats a corrupt preference file as disabled and overwrites it on save", async () => {
    await writeFile(storePath(), "{ not json");

    expect(await getAutoImportEnabled()).toBe(false);

    await setAutoImportEnabled(true);
    expect(await getAutoImportEnabled()).toBe(true);
  });
});
