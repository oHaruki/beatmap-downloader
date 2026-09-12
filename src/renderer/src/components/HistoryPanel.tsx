import { useEffect, useState } from "react";
import type { DownloadHistoryEntry, DownloadJob } from "@shared/types";
import { IconClose } from "./icons";

export function HistoryPanel({ downloading, outputFolder, onRepair, onClose }: {
  downloading: boolean;
  outputFolder: string | null;
  onRepair: (jobs: DownloadJob[]) => void;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<DownloadHistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [missingOnly, setMissingOnly] = useState(false);
  const [limit, setLimit] = useState(100);
  async function refresh(): Promise<void> {
    setLoading(true);
    try { setEntries(await window.api.getDownloadHistory()); setError(""); }
    catch { setError("Could not read download history."); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (outputFolder && !downloading) void refresh(); }, [outputFolder, downloading]);
  const missing = entries.filter((entry) => !entry.exists);
  const visible = missingOnly ? missing : entries;
  return <section className="history-panel" aria-labelledby="history-title">
    <div className="history-header">
      <strong id="history-title">Download history & repair</strong>
      <span className="meta">{entries.length} downloaded · {entries.length - missing.length} files here · {missing.length} missing archives</span>
      <label><input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} /> Missing only</label>
      <button onClick={() => void refresh()} disabled={loading || downloading}>Refresh</button>
      {missing.length > 0 && <button disabled={downloading || loading} onClick={() => onRepair(missing)}>Re-download {missing.length} missing</button>}
      <button className="icon-button" aria-label="Close download history" title="Close" onClick={onClose}><IconClose /></button>
    </div>
    <p className="meta">Repair restores archives to the output folder, including maps already installed in osu!.</p>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="history-list">
      {loading ? <p className="meta">Reading history…</p> : visible.slice(0, limit).map((entry) => <div className="history-row" key={entry.beatmapsetId}>
        <span>{entry.fileName}<small>{entry.downloadedAt.slice(0, 10)} · {entry.exists ? "File available" : "Archive missing"}</small></span>
        <button disabled={downloading} onClick={() => {
          if (entry.exists) void window.api.revealDownload(entry.beatmapsetId).catch(() => { setError("File is missing. Refresh history to repair it."); });
          else onRepair([entry]);
        }}>{entry.exists ? "Show file" : "Re-download"}</button>
      </div>)}
      {!loading && visible.length === 0 && <p className="meta">No downloads to show.</p>}
      {visible.length > limit && <button onClick={() => setLimit(limit + 100)}>Show more</button>}
    </div>
  </section>;
}
