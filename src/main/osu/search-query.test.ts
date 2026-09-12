import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SEARCH_FILTERS } from "../../shared/search-filters.ts";
import { buildSearchUrl } from "./search-query.ts";

describe("buildSearchUrl", () => {
  it("encodes text, ranges, mode, status, and cursor", () => {
    const url = buildSearchUrl({
      ...DEFAULT_SEARCH_FILTERS,
      query: "Camellia",
      mode: "3",
      status: "loved",
      starsMin: "4.5",
      bpmMax: "220",
      cursorString: "next page",
    });

    assert.equal(url.searchParams.get("q"), "Camellia stars>=4.5 bpm<=220");
    assert.equal(url.searchParams.get("m"), "3");
    assert.equal(url.searchParams.get("s"), "loved");
    assert.equal(url.searchParams.get("cursor_string"), "next page");
  });

  it("sends any explicitly and supports inclusive dates, sorting and Mania keys", () => {
    const url = buildSearchUrl({ ...DEFAULT_SEARCH_FILTERS, status: "any" });
    assert.equal(url.searchParams.get("s"), "any");
    const advanced = buildSearchUrl({ ...DEFAULT_SEARCH_FILTERS, mode: "3", keys: "7", sort: "ranked_desc", rankedFrom: "2026-01-01", rankedTo: "2026-01-31" });
    assert.equal(advanced.searchParams.get("q"), "keys=7 ranked>=2026-01-01 ranked<2026-02-01");
    assert.equal(advanced.searchParams.get("sort"), "ranked_desc");
  });
});
