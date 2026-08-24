import { useEffect, useState } from "react";
import { IconClose, IconGear, IconMaximize, IconMinimize, IconRestore } from "./icons";
import iconUrl from "../assets/icon.png";

interface Props {
  onOpenSettings: () => void;
  downloadLabel: string;
  canDownload: boolean;
  onDownload: () => void;
}

export function TitleBar({ onOpenSettings, downloadLabel, canDownload, onDownload }: Props) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    void window.api.windowIsMaximized().then(setMaximized);
    return window.api.onWindowMaximizedChange(setMaximized);
  }, []);

  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <img src={iconUrl} alt="" className="titlebar-icon" />
        <span>beatmap-downloader</span>
      </div>

      <div className="titlebar-actions">
        <button className="titlebar-download" onClick={onDownload} disabled={!canDownload}>
          {downloadLabel}
        </button>
        <button className="titlebar-button" onClick={onOpenSettings} title="Settings">
          <IconGear />
        </button>
      </div>

      <div className="titlebar-buttons">
        <button className="titlebar-button" onClick={() => window.api.windowMinimize()}>
          <IconMinimize />
        </button>
        <button className="titlebar-button" onClick={() => window.api.windowToggleMaximize()}>
          {maximized ? <IconRestore /> : <IconMaximize />}
        </button>
        <button className="titlebar-button close" onClick={() => window.api.windowClose()}>
          <IconClose />
        </button>
      </div>
    </div>
  );
}
