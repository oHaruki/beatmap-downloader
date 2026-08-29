import type { InstalledSongsScan } from "@shared/types";
import { IconGear } from "./icons";

interface Props {
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

function tail(p: string, max = 28): string {
  return p.length <= max ? p : `...${p.slice(-(max - 3))}`;
}

export function DownloadBar({
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
      <button className="download-bar-button" onClick={onDownload} disabled={!canDownload}>
        {label}
      </button>

      <div className="toolbar-folder-group">
        <button
          className="toolbar-folder"
          onClick={onChooseOutputFolder}
          title={outputFolder ?? "Choose where downloads are saved"}
        >
          <span className="toolbar-folder-label">Output</span>
          <span className="toolbar-folder-path">{outputFolder ? tail(outputFolder) : "not set"}</span>
        </button>
        <button
          className="toolbar-folder-open"
          onClick={onOpenOutputFolder}
          disabled={!outputFolder}
          title="Open output folder"
        >
          Open
        </button>
      </div>

      <div className="toolbar-folder-group">
        <button
          className="toolbar-folder"
          onClick={onChooseOsuFolder}
          title={
            osuFolder && songsFolder
              ? `${osuFolder}
Maps are checked and imported through ${songsFolder}
${installedCount} sets detected via ${installedSource ?? "..."}`
              : "Choose the folder that contains osu!.exe; its Songs folder is handled automatically"
          }
        >
          <span className="toolbar-folder-label">osu! folder</span>
          <span className="toolbar-folder-path">
            {osuFolder ? tail(osuFolder) : "not set"}
          </span>
        </button>
        <button
          className="toolbar-folder-open"
          onClick={onOpenOsuFolder}
          disabled={!osuFolder}
          title="Open osu! folder"
        >
          Open
        </button>
      </div>

      <label className="toolbar-check" title="Download maps again even if you already have them">
        <input
          type="checkbox"
          checked={forceRedownload}
          onChange={(e) => onToggleForceRedownload(e.target.checked)}
        />
        re-download
      </label>

      <label
        className="toolbar-check"
        title="Copy each finished download straight into your osu!stable Songs folder."
      >
        <input
          type="checkbox"
          checked={autoImport}
          onChange={(e) => onToggleAutoImport(e.target.checked)}
        />
        add to osu! as soon as downloaded
      </label>

      <button className="download-bar-settings" onClick={onOpenSettings} title="Settings" aria-label="Open settings">
        <IconGear />
      </button>
    </div>
  );
}
