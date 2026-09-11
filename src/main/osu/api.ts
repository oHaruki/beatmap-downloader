// osu! API v2 client (client-credentials grant), search/metadata only.

import type { BeatmapDifficulty, BeatmapsetSummary, SearchFilters } from "@shared/types";
import { getCredentials } from "../credentials";
import { isRecord } from "../json-file";
import { buildSearchUrl } from "./search-query";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;

// Called after credentials are changed in settings, so a token fetched
// under the old key/secret doesn't linger until it naturally expires.
export function resetTokenCache(): void {
  cache = null;
}

export async function hasApiCredentials(): Promise<boolean> {
  const { clientId, clientSecret } = await getCredentials();
  return Boolean(clientId && clientSecret);
}

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function requestAccessToken(
  clientId: string,
  clientSecret: string,
  signal?: AbortSignal,
): Promise<TokenCache> {
  let res: Response;
  try {
    res = await fetch("https://osu.ppy.sh/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "public",
      }),
      signal: requestSignal(signal, 15_000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new OsuApiError("The osu! API did not respond in time. Try again.");
    }
    throw new OsuApiError("Could not reach the osu! API. Check your connection and try again.");
  }

  if (res.status === 400 || res.status === 401) {
    throw new OsuApiError("The osu! API rejected these credentials. Check the client ID and secret.", res.status);
  }
  if (!res.ok) {
    throw new OsuApiError(`The osu! API could not validate credentials (HTTP ${res.status}).`, res.status);
  }

  const body: unknown = await res.json();
  if (
    !isRecord(body) ||
    typeof body["access_token"] !== "string" ||
    typeof body["expires_in"] !== "number"
  ) {
    throw new OsuApiError("The osu! API returned an unexpected authentication response.");
  }
  return {
    token: body["access_token"],
    expiresAt: Date.now() + body["expires_in"] * 1000,
  };
}

export async function verifyApiCredentials(clientId: string, clientSecret: string): Promise<void> {
  await requestAccessToken(clientId, clientSecret);
}

async function getAccessToken(signal?: AbortSignal): Promise<string> {
  const { clientId, clientSecret } = await getCredentials();
  if (!clientId || !clientSecret) {
    throw new OsuApiError("osu! API credentials are not configured. Open Settings to add them.");
  }

  if (cache && cache.expiresAt > Date.now() + 10_000) return cache.token;
  cache = await requestAccessToken(clientId, clientSecret, signal);
  return cache.token;
}

export class OsuApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "OsuApiError";
  }
}

function parseBeatmap(value: unknown): BeatmapDifficulty | null {
  if (
    !isRecord(value) ||
    typeof value["id"] !== "number" ||
    typeof value["version"] !== "string" ||
    typeof value["mode"] !== "string" ||
    typeof value["difficulty_rating"] !== "number"
  ) {
    return null;
  }
  return {
    id: value["id"],
    version: value["version"],
    mode: value["mode"],
    difficulty_rating: value["difficulty_rating"],
    ...Object.fromEntries(["bpm", "total_length", "ar", "cs", "accuracy", "drain"].flatMap((key) =>
      typeof value[key] === "number" && Number.isFinite(value[key]) ? [[key, value[key]]] : [])),
  };
}

function parseBeatmapset(value: unknown): BeatmapsetSummary | null {
  if (
    !isRecord(value) ||
    typeof value["id"] !== "number" ||
    typeof value["title"] !== "string" ||
    typeof value["artist"] !== "string" ||
    typeof value["creator"] !== "string" ||
    typeof value["status"] !== "string" ||
    !Array.isArray(value["beatmaps"])
  ) {
    return null;
  }
  const covers = isRecord(value["covers"]) ? value["covers"] : {};
  return {
    id: value["id"],
    title: value["title"],
    artist: value["artist"],
    creator: value["creator"],
    status: value["status"],
    covers: { card: typeof covers["card"] === "string" ? covers["card"] : undefined },
    beatmaps: value["beatmaps"].map(parseBeatmap).filter((beatmap) => beatmap !== null),
    preview_url: typeof value["preview_url"] === "string" ? value["preview_url"] : undefined,
  };
}

export async function searchBeatmapsets(filters: SearchFilters, signal?: AbortSignal): Promise<{
  beatmapsets: BeatmapsetSummary[];
  cursorString: string | null;
}> {
  const token = await getAccessToken(signal);
  const url = buildSearchUrl(filters);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: requestSignal(signal, 30_000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new OsuApiError("The osu! search request timed out. Try again.");
    }
    throw new OsuApiError("Could not reach the osu! API. Check your connection and try again.");
  }
  if (!res.ok) {
    if (res.status === 401) { resetTokenCache(); throw new OsuApiError("Your osu! API session expired or was rejected. Try again or check Settings.", 401); }
    if (res.status === 429) throw new OsuApiError("osu! is limiting search requests. Wait a moment, then search again.", 429);
    throw new OsuApiError(`osu! API returned ${res.status} for beatmapset search`, res.status);
  }
  const body: unknown = await res.json();
  if (!isRecord(body)) throw new OsuApiError("The osu! API returned an unexpected search response.");
  const beatmapsets = Array.isArray(body["beatmapsets"])
    ? body["beatmapsets"].map(parseBeatmapset).filter((set) => set !== null)
    : [];
  return {
    beatmapsets,
    cursorString: typeof body["cursor_string"] === "string" ? body["cursor_string"] : null,
  };
}
