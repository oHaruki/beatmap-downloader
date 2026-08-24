// osu.ppy.sh requires a login for .osz downloads, so these mirrors are used
// instead. Tried in order; {id} is the beatmapset id.
//
// catboy.best was dropped: it now returns 403 for every set.
// beatconnect is last because it rate limits aggressively (429, and a JSON
// error body rather than a file once it does).
const MIRRORS = [
  "https://mirror.nekoha.moe/api/download/{id}",
  "https://api.nerinyan.moe/d/{id}",
  "https://beatconnect.io/b/{id}",
];

const UA = "beatmap-downloader/0.1 (+https://github.com/)";

export interface MirrorDownloadResult {
  data: Buffer;
  mirror: string;
}

export type ProgressCallback = (bytesDownloaded: number, totalBytes: number | null) => void;

// Streams the body so progress can be reported as bytes arrive; totalBytes
// is null when there's no Content-Length header.
async function readWithProgress(res: Response, onProgress?: ProgressCallback): Promise<Buffer> {
  const totalHeader = res.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : null;
  const reader = res.body?.getReader();
  if (!reader) return Buffer.from(await res.arrayBuffer());

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress?.(received, total);
  }
  return Buffer.concat(chunks);
}

function retryAfterMs(res: Response): number {
  const header = res.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  return Number.isNaN(seconds) ? 5000 : Math.min(seconds * 1000, 20_000);
}

// Surfaces what a mirror actually sent instead of the file, so the error
// says "rate limit exceeded" rather than just "not a zip".
function describeNonZip(data: Buffer): string {
  const text = data.subarray(0, 200).toString("utf-8").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 120) : `${data.length} bytes of unknown data`;
}

// Shared across every in-flight download (not per-request), so one worker
// hitting a 429 makes every other worker skip that mirror too instead of
// each one finding out the hard way. Nothing here blocks the item currently
// downloading; a cooling-down mirror is just skipped in favor of the next.
const mirrorCooldownUntil = new Map<string, number>();

// Falls back through MIRRORS in order, checking the response is a real zip
// (magic bytes "PK") rather than a rate-limit/error page.
export async function downloadFromMirror(
  beatmapsetId: number,
  onProgress?: ProgressCallback
): Promise<MirrorDownloadResult> {
  let lastError: Error | null = null;

  for (const template of MIRRORS) {
    const coolingUntil = mirrorCooldownUntil.get(template);
    if (coolingUntil && Date.now() < coolingUntil) continue;

    const url = template.replace("{id}", String(beatmapsetId));
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(120_000),
      });
      if (res.status === 429) {
        mirrorCooldownUntil.set(template, Date.now() + retryAfterMs(res));
        lastError = new Error(`${url} -> HTTP 429`);
        continue;
      }
      // 403/401 means the mirror is refusing this client outright, not that
      // this one map is unavailable, so back off from it for a good while
      // instead of retrying it for every remaining map in the queue.
      if (res.status === 403 || res.status === 401) {
        mirrorCooldownUntil.set(template, Date.now() + 10 * 60_000);
        lastError = new Error(`${url} -> HTTP ${res.status}`);
        continue;
      }
      if (!res.ok) {
        lastError = new Error(`${url} -> HTTP ${res.status}`);
        continue;
      }
      const data = await readWithProgress(res, onProgress);
      if (data.length < 2 || data[0] !== 0x50 || data[1] !== 0x4b) {
        // Not a zip ("PK"). Usually a JSON/HTML error body served with a 200,
        // which in practice means this mirror is throttling us.
        mirrorCooldownUntil.set(template, Date.now() + 30_000);
        lastError = new Error(`${url} -> not a zip (${describeNonZip(data)})`);
        continue;
      }
      return { data, mirror: url };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError ?? new Error("all mirrors are cooling down, try again shortly");
}
