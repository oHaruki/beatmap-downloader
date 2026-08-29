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
  if (cursor !== undefined && cursor !== null && typeof cursor !== "string") return null;
  if (typeof cursor === "string" || cursor === null) parsed.cursorString = cursor;
  return parsed;
}

export function validateSearchFilters(filters: SearchFilters): string | null {
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
