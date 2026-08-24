import { IconGear } from "./icons";

interface Props {
  label: string;
  canDownload: boolean;
  onDownload: () => void;
  onOpenSettings: () => void;
}

export function DownloadBar({ label, canDownload, onDownload, onOpenSettings }: Props) {
  return (
    <div className="download-bar">
      <button className="download-bar-button" onClick={onDownload} disabled={!canDownload}>
        {label}
      </button>
      <button className="download-bar-settings" onClick={onOpenSettings} title="Settings">
        <IconGear />
      </button>
    </div>
  );
}
