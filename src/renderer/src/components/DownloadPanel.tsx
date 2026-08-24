import type { DownloadProgressEvent } from "@shared/types";

interface Props {
  progress: Map<number, DownloadProgressEvent>;
  labels: Map<number, string>;
  total: number;
}

export function DownloadPanel({ progress, labels, total }: Props) {
  if (total === 0) return null;

  const events = [...progress.values()];
  const active = events.filter((e) => e.status === "downloading");
  const done = events.filter((e) => e.status === "done").length;
  const skipped = events.filter((e) => e.status === "skipped").length;
  const errors = events.filter((e) => e.status === "error");
  const remaining = Math.max(0, total - done - skipped - errors.length);

  return (
    <div className="download-panel">
      <div className="download-summary">
        <span>{done} done</span>
        <span>{skipped} already had</span>
        {errors.length > 0 && <span className="bad">{errors.length} failed</span>}
        <span className="remaining">{remaining} remaining</span>
      </div>

      {active.length > 0 && (
        <div className="active-downloads">
          {active.map((e) => (
            <div key={e.beatmapsetId} className="active-download-row">
              <div className="progress-name-row">
                <span className="progress-name">{labels.get(e.beatmapsetId) ?? e.beatmapsetId}</span>
                <span className="progress-percent">{e.progressPercent != null ? `${e.progressPercent}%` : ""}</span>
              </div>
              <div className={`progress-bar-track${e.progressPercent == null ? " indeterminate" : ""}`}>
                <div
                  className="progress-bar-fill"
                  style={e.progressPercent != null ? { width: `${e.progressPercent}%` } : undefined}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <div className="error-rows">
          {errors.map((e) => (
            <div key={e.beatmapsetId} className="error-row">
              {labels.get(e.beatmapsetId) ?? e.beatmapsetId}: {e.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
