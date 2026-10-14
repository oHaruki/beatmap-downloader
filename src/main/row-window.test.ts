import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rowWindow } from "../renderer/src/row-window.ts";

describe("result row window", () => {
  it("renders only the rows that overlap the visible range", () => {
    assert.deepEqual(rowWindow(37_000, 50, [], 1000, 1500), {
      start: 20,
      end: 31,
      before: 1000,
      after: 37_000 * 50 - 31 * 50,
    });
  });

  it("clamps ranges past either end of the list", () => {
    assert.deepEqual(rowWindow(10, 50, [], -800, 300), { start: 0, end: 7, before: 0, after: 150 });
    assert.deepEqual(rowWindow(10, 50, [], 9000, 9900), { start: 10, end: 10, before: 500, after: 0 });
    assert.deepEqual(rowWindow(0, 50, [], 0, 900), { start: 0, end: 0, before: 0, after: 0 });
  });

  it("accounts for open rows above and inside the range", () => {
    // Row 2 is 250px tall, so row 3 starts at 350 and row 4 at 400.
    const tall = [{ index: 2, height: 250 }];
    assert.deepEqual(rowWindow(100, 50, tall, 400, 449), { start: 4, end: 5, before: 400, after: 5200 - 450 });
    assert.equal(rowWindow(100, 50, tall, 200, 300).start, 2);
    assert.equal(rowWindow(100, 50, tall, 200, 300).before, 100);
    assert.equal(rowWindow(100, 50, tall, 0, 0).after, 5200 - 50);
  });

  it("ignores open rows that are no longer in the list", () => {
    assert.deepEqual(
      rowWindow(10, 50, [{ index: 12, height: 400 }, { index: -1, height: 400 }], 0, 99),
      { start: 0, end: 2, before: 0, after: 400 },
    );
  });
});
