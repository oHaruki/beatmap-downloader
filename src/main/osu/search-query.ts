import { SEARCH_RANGE_FILTERS } from "../../shared/search-filters";
import type { SearchFilters } from "@shared/types";

/** Build the same free-text range query used by osu!'s beatmapset search page. */
export function buildSearchUrl(filters: SearchFilters): URL {
  const queryParts: string[] = [];
  if (filters.query.trim()) queryParts.push(filters.query.trim());
  for (const { queryField, minKey, maxKey } of SEARCH_RANGE_FILTERS) {
    const minimum = filters[minKey].trim();
    const maximum = filters[maxKey].trim();
    if (minimum) queryParts.push(`${queryField}>=${minimum}`);
    if (maximum) queryParts.push(`${queryField}<=${maximum}`);
  }

  const url = new URL("https://osu.ppy.sh/api/v2/beatmapsets/search");
  if (filters.keys) queryParts.push(`keys=${filters.keys}`);
  if (filters.rankedFrom) queryParts.push(`ranked>=${filters.rankedFrom}`);
  if (filters.rankedTo) {
    const end = new Date(filters.rankedTo);
    end.setUTCDate(end.getUTCDate() + 1);
    queryParts.push(`ranked<${end.toISOString().slice(0, 10)}`);
  }
  if (queryParts.length) url.searchParams.set("q", queryParts.join(" "));
  if (filters.mode) url.searchParams.set("m", filters.mode);
  url.searchParams.set("s", filters.status);
  if (filters.sort) url.searchParams.set("sort", filters.sort);
  if (filters.cursorString) url.searchParams.set("cursor_string", filters.cursorString);
  return url;
}
