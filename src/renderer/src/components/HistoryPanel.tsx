import { useEffect, useState } from "react";
import type { DownloadHistoryEntry, DownloadJob } from "@shared/types";

export function HistoryPanel({ downloading, outputFolder, onRepair }: {
  downloading: boolean;
  outputFolder: string | null;
  onRepair: (jobs: DownloadJob[]) => void;
}) {
  const [open, setOpen] = useState(false);
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
  useEffect(() => { if (open && outputFolder && !downloading) void refresh(); }, [open, outputFolder, downloading]);
  const missing = entries.filter((entry) => !entry.exists);
  const visible = missingOnly ? missing : entries;
  return <details className="history-panel" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Download history & repair</summary>
    {open && <>
      <p className="meta">Downloaded previously: {entries.length} · Files here: {entries.length - missing.length} · Missing archives: {missing.length}</p>
      <div className="download-actions">
        <button onClick={() => void refresh()} disabled={loading || downloading}>Refresh</button>
        <label><input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} /> Missing only</label>
        {missing.length > 0 && <button disabled={downloading || loading} onClick={() => onRepair(missing.slice(0, 1000))}>Re-download {Math.min(missing.length, 1000)} missing</button>}
      </div>
      <p className="meta">Repair restores archives to the output folder, including maps already installed in osu!.</p>
      {error && <p className="error-text" role="alert">{error}</p>}
      {loading ? <p>Reading history…</p> : visible.slice(0, limit).map((entry) => <div className="history-row" key={entry.beatmapsetId}>
        <span>{entry.fileName}<small>{entry.downloadedAt.slice(0, 10)} · {entry.exists ? "File available" : "Archive missing"}</small></span>
        <button disabled={downloading} onClick={() => {
          if (entry.exists) void window.api.revealDownload(entry.beatmapsetId).catch(() => { setError("File is missing. Refresh history to repair it."); });
          else onRepair([entry]);
        }}>{entry.exists ? "Show file" : "Re-download"}</button>
      </div>)}
      {!loading && visible.length === 0 && <p className="meta">No downloads to show.</p>}
      {visible.length > limit && <button onClick={() => setLimit(limit + 100)}>Show more</button>}
    </>}
  </details>;
}
