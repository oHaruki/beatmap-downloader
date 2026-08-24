// osu! API v2 client (client-credentials grant), search/metadata only.

import type { BeatmapsetSummary, SearchFilters } from "@shared/types";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.OSU_API_CLIENT_ID;
  const clientSecret = process.env.OSU_API_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cache && cache.expiresAt > Date.now() + 10_000) return cache.token;

  try {
    const res = await fetch("https://osu.ppy.sh/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "public",
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token: string; expires_in: number };
    cache = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return cache.token;
  } catch {
    return null;
  }
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

interface RawSearchResponse {
  beatmapsets?: BeatmapsetSummary[];
  cursor_string?: string;
}

// Numeric ranges (stars, bpm, etc) are read out of the free-text `q`
// string, same as the website's own search bar. Cursor-based pagination.
export async function searchBeatmapsets(filters: SearchFilters): Promise<{
  beatmapsets: BeatmapsetSummary[];
  cursorString: string | null;
}> {
  const token = await getAccessToken();
  if (!token) {
    throw new OsuApiError("osu! API credentials are not configured (OSU_API_CLIENT_ID/SECRET in .env).");
  }

  const qParts: string[] = [];
  if (filters.query.trim()) qParts.push(filters.query.trim());
  const range = (field: string, min: string, max: string): void => {
    if (min.trim()) qParts.push(`${field}>=${min.trim()}`);
    if (max.trim()) qParts.push(`${field}<=${max.trim()}`);
  };
  range("stars", filters.starsMin, filters.starsMax);
  range("bpm", filters.bpmMin, filters.bpmMax);
  range("length", filters.lengthMin, filters.lengthMax);
  range("ar", filters.arMin, filters.arMax);
  range("cs", filters.csMin, filters.csMax);
  range("od", filters.odMin, filters.odMax);
  range("dr", filters.hpMin, filters.hpMax);

  const url = new URL("https://osu.ppy.sh/api/v2/beatmapsets/search");
  if (qParts.length) url.searchParams.set("q", qParts.join(" "));
  if (filters.mode) url.searchParams.set("m", filters.mode);
  // "any" means "don't filter by status" -> omit `s` entirely rather than
  // sending an invalid value the API wouldn't recognize.
  if (filters.status !== "any") url.searchParams.set("s", filters.status);
  if (filters.cursorString) url.searchParams.set("cursor_string", filters.cursorString);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new OsuApiError(`osu! API returned ${res.status} for beatmapset search`, res.status);
  }
  const body = (await res.json()) as RawSearchResponse;
  return { beatmapsets: body.beatmapsets ?? [], cursorString: body.cursor_string ?? null };
}
