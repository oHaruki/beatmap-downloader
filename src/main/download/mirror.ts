import { promises as fs } from "node:fs";

const DEFAULT_MIRRORS = [
  "https://mirror.nekoha.moe/api/download/{id}",
  "https://api.nerinyan.moe/d/{id}",
  "https://beatconnect.io/b/{id}",
] as const;

const USER_AGENT = "beatmap-downloader/0.3.1 (+https://github.com/oHaruki/beatmap-downloader)";
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export interface MirrorDownloadResult {
  bytesDownloaded: number;
  mirror: string;
}

export type ProgressCallback = (bytesDownloaded: number, totalBytes: number | null) => void;

export interface MirrorDownloadOptions {
  signal?: AbortSignal;
  onProgress?: ProgressCallback;
}

export interface MirrorDownloadDeps {
  fetch?: typeof fetch;
  mirrors?: readonly string[];
  now?: () => number;
}

const mirrorCooldownUntil = new Map<string, number>();

function abortError(): Error {
  const error = new Error("Download cancelled");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError();
}

function combinedSignal(signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function responseLength(response: Response): number | null {
  const header = response.headers.get("content-length");
  if (!header) return null;
  const value = Number(header);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function retryAfterMs(response: Response, now: number): number {
  const header = response.headers.get("retry-after");
  if (!header) return 5_000;

  const seconds = Number(header);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now;
  return Number.isFinite(delay) ? Math.max(1_000, Math.min(delay, 5 * 60_000)) : 5_000;
}

function describeNonZip(data: Uint8Array): string {
  const text = Buffer.from(data.subarray(0, 200)).toString("utf8").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 120) : `${data.length} bytes of unknown data`;
}

async function writeResponseToFile(
  response: Response,
  destination: string,
  options: MirrorDownloadOptions,
): Promise<number> {
  const total = responseLength(response);
  if (total !== null && total > MAX_DOWNLOAD_BYTES) {
    throw new Error(`download is larger than the ${MAX_DOWNLOAD_BYTES / 1024 / 1024 / 1024} GB safety limit`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("mirror response did not contain a file body");

  const handle = await fs.open(destination, "w");
  let received = 0;
  let header = Buffer.alloc(0);
  let headerValidated = false;
  let completed = false;
  try {
    for (;;) {
      throwIfAborted(options.signal);
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;

      received += value.byteLength;
      if (received > MAX_DOWNLOAD_BYTES) {
        throw new Error(`download exceeded the ${MAX_DOWNLOAD_BYTES / 1024 / 1024 / 1024} GB safety limit`);
      }

      if (!headerValidated) {
        header = Buffer.concat([header, value]);
        if (header.length < 2) continue;
        if (header[0] !== 0x50 || header[1] !== 0x4b) {
          throw new Error(`not a zip (${describeNonZip(header)})`);
        }
        headerValidated = true;
        await handle.write(header);
        header = Buffer.alloc(0);
      } else {
        await handle.write(value);
      }
      options.onProgress?.(received, total);
    }

    if (!headerValidated) throw new Error("not a zip (empty response)");
    await handle.sync();
    completed = true;
    return received;
  } finally {
    await handle.close();
    if (!completed) await reader.cancel().catch(() => undefined);
  }
}

export async function downloadFromMirrorToFile(
  beatmapsetId: number,
  destination: string,
  options: MirrorDownloadOptions = {},
  deps: MirrorDownloadDeps = {},
): Promise<MirrorDownloadResult> {
  const fetchRequest = deps.fetch ?? fetch;
  const mirrors = deps.mirrors ?? DEFAULT_MIRRORS;
  const now = deps.now ?? Date.now;
  let lastError: Error | null = null;
  let soonestCooldown: number | null = null;

  for (const template of mirrors) {
    throwIfAborted(options.signal);
    const coolingUntil = mirrorCooldownUntil.get(template);
    if (coolingUntil && now() < coolingUntil) {
      soonestCooldown = Math.min(soonestCooldown ?? coolingUntil, coolingUntil);
      continue;
    }

    const url = template.replace("{id}", String(beatmapsetId));
    try {
      const response = await fetchRequest(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: combinedSignal(options.signal),
      });
      if (response.status === 429) {
        mirrorCooldownUntil.set(template, now() + retryAfterMs(response, now()));
        lastError = new Error(`${new URL(url).hostname} returned HTTP 429`);
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        mirrorCooldownUntil.set(template, now() + 10 * 60_000);
        lastError = new Error(`${new URL(url).hostname} returned HTTP ${response.status}`);
        continue;
      }
      if (!response.ok) {
        lastError = new Error(`${new URL(url).hostname} returned HTTP ${response.status}`);
        continue;
      }

      await fs.rm(destination, { force: true });
      const bytesDownloaded = await writeResponseToFile(response, destination, options);
      return { bytesDownloaded, mirror: new URL(url).hostname };
    } catch (error) {
      await fs.rm(destination, { force: true }).catch(() => undefined);
      if (options.signal?.aborted) throw abortError();
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.message.startsWith("not a zip")) {
        mirrorCooldownUntil.set(template, now() + 30_000);
      }
    }
  }

  if (!lastError && soonestCooldown !== null) {
    const seconds = Math.max(1, Math.ceil((soonestCooldown - now()) / 1000));
    throw new Error(`all mirrors are cooling down; try again in ${seconds} seconds`);
  }
  throw lastError ?? new Error("no download mirrors are configured");
}
