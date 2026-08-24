# beatmap-downloader

<p align="center"><strong>Batch osu! beatmap downloader</strong></p>

<p align="center">
<a href="https://github.com/oHaruki/beatmap-downloader/releases/latest"><img src="https://img.shields.io/github/v/release/oHaruki/beatmap-downloader" alt="Latest release"></a>
<a href="https://github.com/oHaruki/beatmap-downloader/issues"><img src="https://img.shields.io/github/issues/oHaruki/beatmap-downloader" alt="Issues"></a>
<a href="LICENSE"><img src="https://img.shields.io/github/license/oHaruki/beatmap-downloader" alt="License"></a>
</p>

Filter by star rating, mode, status, BPM, length, AR, CS, OD, and HP drain
through the official osu! API, then pull the actual files through a mirror
cascade.

## Early build, expect rough edges

This is a very early build, put together quickly. If something breaks or
looks wrong, please open an issue on the
[Issues page](https://github.com/oHaruki/beatmap-downloader/issues).

The mirrors this relies on (Nekoha, Nerinyan, Beatconnect) are
community-run, not something this project controls. They can be slow, rate
limit you, or go down for a while. The app backs off and falls back between
them, but if all three are having a bad day at once, downloads will fail
until they recover.

## Quick start

1. Download the latest zip from the
   [Releases page](https://github.com/oHaruki/beatmap-downloader/releases/latest).
2. Unzip it anywhere and run `beatmap-downloader.exe`. Nothing is installed,
   and settings/downloads stay in that folder, so you can put it on a USB
   stick or delete the folder to fully remove it.
3. On first launch it asks for osu! API credentials. Register an OAuth app
   at https://osu.ppy.sh/home/account/edit (client-credentials grant, no
   redirect URI needed) and paste in the client id and secret. You can
   change them later with the gear button.

Windows will likely warn about an unknown publisher, since the exe is not
code signed.

### Running from source

```bash
git clone https://github.com/oHaruki/beatmap-downloader.git
cd beatmap-downloader
npm install
npm run dev
```

Credentials can go in a `.env` (see `.env.example`) instead of the settings
window if you prefer.

## How it works

- Searching and filtering goes through the official osu! API v2.
- The actual `.osz` files come from a mirror cascade (Nekoha, then Nerinyan,
  then Beatconnect), since osu.ppy.sh requires a real logged-in session for
  direct downloads.
- Maps you already have are detected and skipped automatically. Ownership
  is read from `osu!.db` (osu!'s own index, which knows the real beatmapset
  id no matter what a folder is named) unioned with a scan of the Songs
  folder itself, plus anything downloaded through this app before. osu! only
  rewrites `osu!.db` when it exits, so the Songs folder is rescanned
  whenever the window regains focus — import in osu!, alt-tab back, done.
  Lazer is not covered; it stores beatmaps content-addressed rather than as
  named folders.

## Downloading through your own account (WIP)

Working on a way to download through a real logged-in osu! session instead
of only relying on mirrors, using your own account so it counts against
your own entitlements rather than a shared path. Not done yet.

## No auto-import

Downloaded maps land in a folder you choose. They are not automatically
copied into your osu! Songs folder or imported for you. Doing that for a
large batch would mean dumping a lot of files into a running osu! client's
watched folder very fast, which is not something this app wants to do to
your client. Drag the `.osz` files in, or double-click them, whenever
you're ready.

## Mirrors

If you run one of the mirrors this project uses and want to talk about
working together more directly, open an issue or get in touch.
