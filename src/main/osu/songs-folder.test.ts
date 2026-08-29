import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { resolveOsuFolder } from "./songs-folder";

async function createOsuInstall(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "beatmap-downloader-osu-"));
  await Promise.all([
    fs.writeFile(path.join(root, "osu!.exe"), ""),
    fs.mkdir(path.join(root, "Songs")),
  ]);
  return root;
}

test("resolveOsuFolder", async (t) => {
  await t.test("uses Songs when the install folder or Songs folder is selected", async (t) => {
    const root = await createOsuInstall();
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    const fromRoot = await resolveOsuFolder(root);
    const fromSongs = await resolveOsuFolder(path.join(root, "Songs"));

    assert.deepEqual(fromRoot, { osuFolder: root, songsFolder: path.join(root, "Songs") });
    assert.deepEqual(fromSongs, fromRoot);
  });

  await t.test("honors osu!'s configured BeatmapDirectory", async (t) => {
    const root = await createOsuInstall();
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const customSongs = path.join(root, "Custom beatmaps");
    await fs.mkdir(customSongs);
    await fs.writeFile(
      path.join(root, "osu!.test.cfg"),
      `BeatmapDirectory = ${customSongs}\n`,
      "utf8",
    );

    assert.deepEqual(await resolveOsuFolder(root), {
      osuFolder: root,
      songsFolder: customSongs,
    });
  });

  await t.test("rejects a folder that is not an osu!stable install", async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "beatmap-downloader-not-osu-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    await assert.rejects(resolveOsuFolder(root), /contains osu!\.exe/);
  });
});
