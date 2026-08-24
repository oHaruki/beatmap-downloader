interface Props {
  label: string;
  canDownload: boolean;
  onDownload: () => void;
}

export function DownloadBar({ label, canDownload, onDownload }: Props) {
  return (
    <div className="download-bar">
      <button className="download-bar-button" onClick={onDownload} disabled={!canDownload}>
        {label}
      </button>
    </div>
  );
}
