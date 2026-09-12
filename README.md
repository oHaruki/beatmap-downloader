# beatmap-downloader

<p align="center"><strong>Batch osu! beatmap downloader</strong></p>

<p align="center">
<a href="https://github.com/oHaruki/beatmap-downloader/releases/latest"><img src="https://img.shields.io/github/v/release/oHaruki/beatmap-downloader" alt="Latest release"></a>
<a href="https://github.com/oHaruki/beatmap-downloader/issues"><img src="https://img.shields.io/github/issues/oHaruki/beatmap-downloader" alt="Issues"></a>
<a href="LICENSE"><img src="https://img.shields.io/github/license/oHaruki/beatmap-downloader" alt="License"></a>
</p>

Filter by star rating, mode, status (including WIP), BPM, length, AR, CS, OD, and HP drain
through the official osu! API, then pull the actual files through a mirror
cascade. Save search presets, sort results, choose Mania 4K/7K and ranked-date
ranges, inspect difficulty details, or play an audio preview before downloading.

## Early build, expect rough edges

This is a very early build, put together quickly. If something breaks or
looks wrong, please open an issue on the
[Issues page](https://github.com/oHaruki/beatmap-downloader/issues).

The mirrors this relies on (Nerinyan, Beatconnect) are
community-run, not something this project controls. They can be slow, rate
limit you, or go down for a while. The app backs off and falls back between
them, but if both are having a bad day at once, downloads will fail
until they recover.

## Quick start

1. Download the latest zip from the
   [Releases page](https://github.com/oHaruki/beatmap-downloader/releases/latest).
2. Unzip it anywhere and run `beatmap-downloader.exe`. Nothing is installed,
   and settings/downloads stay in that folder. Optionally remembered credentials
   stay on your PC, as described below.
3. On first launch it asks for osu! API credentials. Register an OAuth app
   at https://osu.ppy.sh/home/account/edit (client-credentials grant, no
   redirect URI needed) and paste in the client id and secret. You can
   change them later with the gear button.

### Remember credentials on this PC

In Settings, opt into **Remember on this PC** to keep your client ID and secret
across restarts, moves, and new portable builds. They are encrypted using Windows
credential protection in
`%APPDATA%\beatmap-downloader\credentials.json`, outside the portable folder.
Only the same Windows account can normally decrypt this file.

When unchecked, newly entered credentials are used only for the current session.
Uncheck and save to remove the remembered copy while continuing this session,
or choose **Forget saved credentials** to clear both the saved copy and the
current session. A blank secret field keeps the current secret when the client
ID is unchanged. Saving verifies the credentials with osu! first.

Old credentials in the portable `config.json` and explicit `.env` credentials
remain supported. Saving through the new Settings removes the legacy plaintext
credentials from that portable config. A user-managed `.env` is not modified.
Saved search presets remain in the portable `config.json`.

### Remember or automatically find osu!

Settings has two independent, opt-in folder preferences:

- **Remember my osu! folder on this PC** restores the selected installation on
  the next launch, even after replacing the portable build.
- **Find osu! automatically at launch** checks the registered osu! installation
  and common Windows install locations when no remembered installation is
  available. It reads osu!'s configuration to locate custom Songs directories.

Click **Save folder preferences**; no API credentials are needed to save these
options. **Choose folder** accepts the installation folder or its standard
Songs folder. With both options off, your selection lasts only for the session.
Turning off Remember removes the stored path, while keeping the current
session's selection. Folder preferences are stored in
`%APPDATA%\beatmap-downloader\folders.json`; this file is removed when both
options are disabled. Previous portable configs' folder paths are no longer
loaded automatically: select your installation once and opt in to remembering it.

Windows will likely warn about an unknown publisher, since the exe is not
code signed.

### Running from source

Node.js 22.12 or newer is required.

```bash
git clone https://github.com/oHaruki/beatmap-downloader.git
cd beatmap-downloader
npm ci
npm run dev
```

Credentials can go in a `.env` (see `.env.example`) instead of the settings
window if you prefer.

Run `npm run check` before opening a pull request. It type-checks the main and
renderer processes, runs the test suite, and verifies a production build.

## How it works

- Searching and filtering goes through the official osu! API v2.
- Searches keep loading pages until every matching map has been found. You can
  cancel a broad search without losing the results already loaded.
- The actual `.osz` files come from a mirror cascade (Nerinyan, then
  Beatconnect), since osu.ppy.sh requires a real logged-in session for
  direct downloads. Files are streamed to temporary `.part` files and only
  moved into place after validation, so an interrupted download cannot look
  complete. Failed or cancelled items can be retried from the download panel.
- Choose the osu! installation folder that contains `osu!.exe`; the app resolves
  its configured `Songs` directory automatically for ownership checks and
  imports. Maps you already have are detected and skipped automatically.
  Ownership is read from `osu!.db` (osu!'s own index, which knows the real
  beatmapset id no matter what a folder is named) unioned with a scan of the
  Songs folder itself, plus downloaded archives still in the output folder. osu!
  only rewrites `osu!.db` when it exits, so the Songs folder is rescanned
  whenever the window regains focus — import in osu!, alt-tab back, done.
- The app currently targets osu!stable only.
- **Download history & repair** shows previous downloads and whether their
  archives still exist. Re-download missing files without having to search for
  them again, even if the maps are already installed. Moving the portable folder
  together with its downloads preserves file detection.
- **Show file** reveals a downloaded archive in Explorer. **Export unfinished
  IDs** saves failed or cancelled beatmapset IDs as a text file.
- The parsed `osu!.db` is reused until the file changes; the Songs directory is
  still rescanned so imports made while osu! is open are detected.

## Downloading through your own account (WIP)

Working on a way to download through a real logged-in osu! session instead
of only relying on mirrors, using your own account so it counts against
your own entitlements rather than a shared path. Not done yet.

## Optional auto-import

Downloaded maps always remain in the output folder you choose. When
**add to osu! as soon as downloaded** is enabled, each completed `.osz` is
also copied silently into the configured osu!stable `Songs` folder. If that
copy fails, the app falls back to opening the original file with osu!stable.

## Mirrors

If you run one of the mirrors this project uses and want to talk about
working together more directly, open an issue or get in touch.
