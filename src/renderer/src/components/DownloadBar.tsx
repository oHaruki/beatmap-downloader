import type { InstalledSongsScan } from "@shared/types";
import { IconChevron, IconFolder, IconGear } from "./icons";

interface Props {
  busy: boolean;
  label: string;
  canDownload: boolean;
  onDownload: () => void;
  onOpenSettings: () => void;
  outputFolder: string | null;
  onChooseOutputFolder: () => void;
  onOpenOutputFolder: () => void;
  osuFolder: string | null;
  songsFolder: string | null;
  onChooseOsuFolder: () => void;
  onOpenOsuFolder: () => void;
  installedCount: number;
  installedSource: InstalledSongsScan["source"] | null;
  forceRedownload: boolean;
  onToggleForceRedownload: (value: boolean) => void;
  autoImport: boolean;
  onToggleAutoImport: (value: boolean) => void;
}

// The options and folder menus are native popovers: light dismiss, Esc and
// focus handling come from the browser.
export function DownloadBar({
  busy,
  label,
  canDownload,
  onDownload,
  onOpenSettings,
  outputFolder,
  onChooseOutputFolder,
  onOpenOutputFolder,
  osuFolder,
  songsFolder,
  onChooseOsuFolder,
  onOpenOsuFolder,
  installedCount,
  installedSource,
  forceRedownload,
  onToggleForceRedownload,
  autoImport,
  onToggleAutoImport,
}: Props) {
  return (
    <div className="download-bar">
      <div className="split-button">
        <button className="download-bar-button" onClick={onDownload} disabled={!canDownload}>
          {label}
        </button>
        <button className="split-toggle" popoverTarget="download-options" aria-label="Download options" title="Download options">
          <IconChevron />
        </button>
      </div>
      <div id="download-options" popover="auto" className="menu-popover">
        <label className="menu-check">
          <input
            type="checkbox"
            checked={forceRedownload}
            onChange={(e) => onToggleForceRedownload(e.target.checked)}
          />
          <span>
            Re-download maps I already have
            <small>Includes installed and previously downloaded maps in the batch.</small>
          </span>
        </label>
        <label className="menu-check">
          <input type="checkbox" checked={autoImport} onChange={(e) => onToggleAutoImport(e.target.checked)} />
          <span>
            Add to osu! as soon as downloaded
            <small>Copies each finished download into your osu!stable Songs folder.</small>
          </span>
        </label>
      </div>
      {forceRedownload && <span className="option-tag">Re-download on</span>}
      {autoImport && <span className="option-tag">Auto-import on</span>}

      <button className="folders-button" popoverTarget="folders-menu" title="Output and osu! folders">
        <IconFolder />
        Folders
        <span className={`folders-summary${osuFolder ? "" : " warn"}`}>
          {osuFolder ? `${installedCount.toLocaleString()} installed` : "osu! not set"}
        </span>
      </button>
      <div id="folders-menu" popover="auto" className="menu-popover folders-popover">
        <section className="menu-section">
          <span className="menu-label">Output folder</span>
          <span className="menu-path">{outputFolder ?? "not set"}</span>
          <div className="menu-actions">
            <button onClick={onOpenOutputFolder} disabled={!outputFolder}>Open</button>
            <button onClick={onChooseOutputFolder} disabled={busy}>Change…</button>
          </div>
        </section>
        <section className="menu-section">
          <span className="menu-label">osu! folder</span>
          <span className="menu-path">{osuFolder ?? "not set"}</span>
          <span className="menu-note">
            {osuFolder && songsFolder
              ? `Songs: ${songsFolder} · ${installedCount.toLocaleString()} sets detected via ${installedSource ?? "…"}`
              : "Choose the folder that contains osu!.exe; its Songs folder is handled automatically."}
          </span>
          <div className="menu-actions">
            <button onClick={onOpenOsuFolder} disabled={!osuFolder}>Open</button>
            <button onClick={onChooseOsuFolder} disabled={busy}>Change…</button>
          </div>
        </section>
      </div>

      <button className="download-bar-settings" onClick={onOpenSettings} title="Settings" aria-label="Open settings">
        <IconGear />
      </button>
    </div>
  );
}
