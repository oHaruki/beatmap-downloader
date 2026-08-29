import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SEARCH_FILTERS,
  parseSearchFilters,
  validateSearchFilters,
} from "../shared/search-filters.ts";

describe("search filters", () => {
  it("rejects reversed and out-of-range values", () => {
    assert.equal(
      validateSearchFilters({ ...DEFAULT_SEARCH_FILTERS, starsMin: "8", starsMax: "4" }),
      "Star rating minimum cannot be greater than its maximum.",
    );
    assert.equal(
      validateSearchFilters({ ...DEFAULT_SEARCH_FILTERS, bpmMax: "401" }),
      "BPM maximum must be between 0 and 400.",
    );
  });

  it("accepts valid empty and decimal ranges", () => {
    assert.equal(validateSearchFilters(DEFAULT_SEARCH_FILTERS), null);
    assert.equal(
      validateSearchFilters({ ...DEFAULT_SEARCH_FILTERS, starsMin: "4.2", starsMax: "6.8" }),
      null,
    );
  });

  it("parses only complete filter objects", () => {
    assert.deepEqual(parseSearchFilters(DEFAULT_SEARCH_FILTERS), DEFAULT_SEARCH_FILTERS);
    assert.equal(parseSearchFilters({ query: "incomplete" }), null);
    assert.equal(parseSearchFilters({ ...DEFAULT_SEARCH_FILTERS, mode: "9" }), null);
  });
});
