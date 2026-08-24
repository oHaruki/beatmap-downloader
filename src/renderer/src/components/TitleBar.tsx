import { useEffect, useState } from "react";
import { IconClose, IconMaximize, IconMinimize, IconRestore } from "./icons";
import iconUrl from "../assets/icon.png";

export function TitleBar() {
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
