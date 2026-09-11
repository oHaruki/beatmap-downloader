import type { SearchFilters } from "./types";

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  query: "",
  mode: "",
  status: "ranked",
  starsMin: "",
  starsMax: "",
  bpmMin: "",
  bpmMax: "",
  lengthMin: "",
  lengthMax: "",
  arMin: "",
  arMax: "",
  csMin: "",
  csMax: "",
  odMin: "",
  odMax: "",
  hpMin: "",
  hpMax: "",
  sort: "",
  keys: "",
  rankedFrom: "",
  rankedTo: "",
};

export const SEARCH_RANGE_FILTERS = [
  {
    label: "Star rating",
    queryField: "stars",
    minKey: "starsMin",
    maxKey: "starsMax",
    min: 0,
    max: 12,
  },
  { label: "BPM", queryField: "bpm", minKey: "bpmMin", maxKey: "bpmMax", min: 0, max: 400 },
  {
    label: "Length",
    queryField: "length",
    minKey: "lengthMin",
    maxKey: "lengthMax",
    min: 0,
    max: 600,
  },
  { label: "Approach rate", queryField: "ar", minKey: "arMin", maxKey: "arMax", min: 0, max: 11 },
  { label: "Circle size", queryField: "cs", minKey: "csMin", maxKey: "csMax", min: 0, max: 10 },
  {
    label: "Overall difficulty",
    queryField: "od",
    minKey: "odMin",
    maxKey: "odMax",
    min: 0,
    max: 11,
  },
  { label: "HP drain", queryField: "dr", minKey: "hpMin", maxKey: "hpMax", min: 0, max: 10 },
] as const satisfies ReadonlyArray<{
  label: string;
  queryField: string;
  minKey: keyof SearchFilters;
  maxKey: keyof SearchFilters;
  min: number;
  max: number;
}>;

const MODES = new Set<SearchFilters["mode"]>(["", "0", "1", "2", "3"]);
const STATUSES = new Set<SearchFilters["status"]>([
  "any",
  "ranked",
  "qualified",
  "loved",
  "pending",
  "wip",
  "graveyard",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSearchFilters(value: unknown): SearchFilters | null {
  if (!isRecord(value) || typeof value["query"] !== "string") return null;

  const mode = value["mode"];
  const status = value["status"];
  if (typeof mode !== "string" || !MODES.has(mode as SearchFilters["mode"])) return null;
  if (typeof status !== "string" || !STATUSES.has(status as SearchFilters["status"])) return null;

  const parsed: SearchFilters = {
    ...DEFAULT_SEARCH_FILTERS,
    query: value["query"],
    mode: mode as SearchFilters["mode"],
    status: status as SearchFilters["status"],
  };

  for (const { minKey, maxKey } of SEARCH_RANGE_FILTERS) {
    const minimum = value[minKey];
    const maximum = value[maxKey];
    if (typeof minimum !== "string" || typeof maximum !== "string") return null;
    parsed[minKey] = minimum;
    parsed[maxKey] = maximum;
  }

  const cursor = value["cursorString"];
  for (const key of ["sort", "keys", "rankedFrom", "rankedTo"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "string") return null;
    parsed[key] = typeof value[key] === "string" ? value[key] : "";
  }
  if (cursor !== undefined && cursor !== null && typeof cursor !== "string") return null;
  if (typeof cursor === "string" || cursor === null) parsed.cursorString = cursor;
  return parsed;
}

export function validateSearchFilters(filters: SearchFilters): string | null {
  if (!["", "relevance_desc", "ranked_desc", "ranked_asc", "title_asc", "artist_asc", "difficulty_asc", "difficulty_desc", "plays_desc", "favourites_desc"].includes(filters.sort ?? "")) return "Choose a valid sort order.";
  if (!["", "4", "7"].includes(filters.keys ?? "")) return "Choose 4K or 7K.";
  if (filters.keys && filters.mode !== "3") return "Key count is only available for Mania.";
  for (const date of [filters.rankedFrom, filters.rankedTo]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) return "Choose a valid ranked date.";
  }
  if (filters.rankedFrom && filters.rankedTo && filters.rankedFrom > filters.rankedTo) return "The ranked start date must be before the end date.";
  for (const spec of SEARCH_RANGE_FILTERS) {
    const minimumText = filters[spec.minKey].trim();
    const maximumText = filters[spec.maxKey].trim();
    const minimum = minimumText ? Number(minimumText) : null;
    const maximum = maximumText ? Number(maximumText) : null;

    if (minimum !== null && (!Number.isFinite(minimum) || minimum < spec.min || minimum > spec.max)) {
      return `${spec.label} minimum must be between ${spec.min} and ${spec.max}.`;
    }
    if (maximum !== null && (!Number.isFinite(maximum) || maximum < spec.min || maximum > spec.max)) {
      return `${spec.label} maximum must be between ${spec.min} and ${spec.max}.`;
    }
    if (minimum !== null && maximum !== null && minimum > maximum) {
      return `${spec.label} minimum cannot be greater than its maximum.`;
    }
  }

  return null;
}
