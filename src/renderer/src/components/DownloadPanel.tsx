import type { DownloadJob, DownloadProgressEvent } from "@shared/types";

// Rows past this stay out of the DOM; progress re-renders the list every 50 ms.
const MAX_BATCH_ROWS = 500;

interface Props {
  progress: Map<number, DownloadProgressEvent>;
  labels: Map<number, string>;
  total: number;
  downloading: boolean;
  cancelling: boolean;
  retryableCount: number;
  onCancel: () => void;
  onRetry: () => void;
  onExport: () => void;
  /** Fill the main area with every map of the batch, used when there are no
   *  search results to share the space with (link downloads, repairs). */
  expandedJobs?: DownloadJob[];
}

function statusText(event: DownloadProgressEvent | undefined): string {
  switch (event?.status) {
    case "downloading":
      return event.progressPercent != null ? `${event.progressPercent}%` : (event.message ?? "starting");
    case "done":
      return event.message ? `done, ${event.message}` : `done${event.mirror ? ` via ${event.mirror}` : ""}`;
    case "skipped":
      return event.message ?? "skipped";
    case "error":
      return `failed: ${event.message ?? "unknown error"}`;
    case "cancelled":
      return "cancelled";
    default:
      return "queued";
  }
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
  onExport,
  expandedJobs,
}: Props) {
  if (total === 0) return null;

  const events = [...progress.values()];
  const active = events.filter((event) => event.status === "downloading");
  const doneEvents = events.filter((event) => event.status === "done");
  const skipped = events.filter((event) => event.status === "skipped").length;
  const cancelled = events.filter((event) => event.status === "cancelled").length;
  const errors = events.filter((event) => event.status === "error");
  const warnings = doneEvents.filter((event) => event.message);
  const finished = Math.min(total, doneEvents.length + skipped + cancelled + errors.length);
  const remaining = total - finished;
  const mirrors = new Map<string, number>();
  for (const event of doneEvents) {
    if (event.mirror) mirrors.set(event.mirror, (mirrors.get(event.mirror) ?? 0) + 1);
  }

  return (
    <section className={`download-panel${expandedJobs ? " expanded" : ""}`} aria-label="Downloads">
      <div className="download-head">
        <strong>{downloading ? (cancelling ? "Cancelling…" : "Downloading") : "Last batch"}</strong>
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
          {retryableCount > 0 && <button onClick={onExport}>Export unfinished IDs</button>}
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
        </div>
      </div>

      <div
        className="progress-bar-track overall"
        role="progressbar"
        aria-label="Batch progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={finished}
      >
        <div className="progress-bar-fill" style={{ width: `${(finished / total) * 100}%` }} />
      </div>

      {expandedJobs ? (
        <div className="batch-list">
          {expandedJobs.slice(0, MAX_BATCH_ROWS).map((job) => {
            const event = progress.get(job.beatmapsetId);
            const status = event?.status ?? "queued";
            return (
              <div key={job.beatmapsetId} className={`batch-row ${status}${event?.message && status === "done" ? " warning" : ""}`}>
                <div className="progress-name-row">
                  <span className="progress-name">{labels.get(job.beatmapsetId) ?? job.fileName}</span>
                  <span className="progress-percent" title={statusText(event)}>{statusText(event)}</span>
                </div>
                {status === "downloading" && (
                  <div className={`progress-bar-track${event?.progressPercent == null ? " indeterminate" : ""}`}>
                    <div
                      className="progress-bar-fill"
                      style={event?.progressPercent != null ? { width: `${event.progressPercent}%` } : undefined}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {expandedJobs.length > MAX_BATCH_ROWS && (
            <p className="meta">{(expandedJobs.length - MAX_BATCH_ROWS).toLocaleString()} more maps not listed</p>
          )}
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="active-downloads">
              {active.map((event) => (
                <div key={event.beatmapsetId} className="active-download-row">
                  <div className="progress-name-row">
                    <span className="progress-name">
                      {labels.get(event.beatmapsetId) ?? event.beatmapsetId}
                    </span>
                    <span className="progress-percent">
                      {event.progressPercent != null ? `${event.progressPercent}%` : (event.message ?? "")}
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
        </>
      )}

      {mirrors.size > 0 && (
        <p className="mirror-summary">
          {Array.from(mirrors, ([mirror, count]) => `${count} via ${mirror}`).join(" · ")}
        </p>
      )}
    </section>
  );
}
