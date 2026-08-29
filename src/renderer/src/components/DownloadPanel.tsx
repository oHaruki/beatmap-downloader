import type { DownloadProgressEvent } from "@shared/types";

interface Props {
  progress: Map<number, DownloadProgressEvent>;
  labels: Map<number, string>;
  total: number;
  downloading: boolean;
  cancelling: boolean;
  retryableCount: number;
  onCancel: () => void;
  onRetry: () => void;
}

export function DownloadPanel({
  progress,
  labels,
  total,
  downloading,
  cancelling,
  retryableCount,
  onCancel,
  onRetry,
}: Props) {
  if (total === 0) return null;

  const events = [...progress.values()];
  const active = events.filter((event) => event.status === "downloading");
  const doneEvents = events.filter((event) => event.status === "done");
  const skipped = events.filter((event) => event.status === "skipped").length;
  const cancelled = events.filter((event) => event.status === "cancelled").length;
  const errors = events.filter((event) => event.status === "error");
  const warnings = doneEvents.filter((event) => event.message);
  const remaining = Math.max(
    0,
    total - doneEvents.length - skipped - cancelled - errors.length,
  );
  const mirrors = new Map<string, number>();
  for (const event of doneEvents) {
    if (event.mirror) mirrors.set(event.mirror, (mirrors.get(event.mirror) ?? 0) + 1);
  }

  return (
    <div className="download-panel">
      <div className="download-summary">
        <span>{doneEvents.length} done</span>
        {skipped > 0 && <span>{skipped} already had</span>}
        {cancelled > 0 && <span>{cancelled} cancelled</span>}
        {warnings.length > 0 && (
          <span className="warning">
            {warnings.length} import warning{warnings.length === 1 ? "" : "s"}
          </span>
        )}
        {errors.length > 0 && <span className="bad">{errors.length} failed</span>}
        <span className="remaining">{remaining} remaining</span>
      </div>

      <div className="download-actions">
        {downloading && (
          <button type="button" onClick={onCancel} disabled={cancelling}>
            {cancelling ? "Cancelling..." : "Cancel batch"}
          </button>
        )}
        {!downloading && retryableCount > 0 && (
          <button type="button" onClick={onRetry}>
            Retry {retryableCount} unfinished
          </button>
        )}
        {mirrors.size > 0 && (
          <span className="mirror-summary">
            {Array.from(mirrors, ([mirror, count]) => `${count} via ${mirror}`).join(" · ")}
          </span>
        )}
      </div>

      {active.length > 0 && (
        <div className="active-downloads">
          {active.map((event) => (
            <div key={event.beatmapsetId} className="active-download-row">
              <div className="progress-name-row">
                <span className="progress-name">
                  {labels.get(event.beatmapsetId) ?? event.beatmapsetId}
                </span>
                <span className="progress-percent">
                  {event.progressPercent != null ? `${event.progressPercent}%` : ""}
                </span>
              </div>
              <div className={`progress-bar-track${event.progressPercent == null ? " indeterminate" : ""}`}>
                <div
                  className="progress-bar-fill"
                  style={
                    event.progressPercent != null ? { width: `${event.progressPercent}%` } : undefined
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {(warnings.length > 0 || errors.length > 0) && (
        <div className="message-rows">
          {warnings.map((event) => (
            <div key={`warning-${event.beatmapsetId}`} className="warning-row">
              {labels.get(event.beatmapsetId) ?? event.beatmapsetId}: {event.message}
            </div>
          ))}
          {errors.map((event) => (
            <div key={`error-${event.beatmapsetId}`} className="error-row">
              {labels.get(event.beatmapsetId) ?? event.beatmapsetId}: {event.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
