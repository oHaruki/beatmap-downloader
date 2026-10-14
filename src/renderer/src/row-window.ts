// Which rows of a long list to keep in the DOM. Every row is rowHeight tall
// except a few open ones (difficulty table or preview player showing), which
// are passed in with their measured height.

export interface TallRow {
  index: number;
  height: number;
}

export interface RowWindow {
  /** First rendered row. */
  start: number;
  /** One past the last rendered row. */
  end: number;
  /** Space standing in for the rows above and below the rendered ones. */
  before: number;
  after: number;
}

/** The rows that overlap the pixel range top..bottom of the list. */
export function rowWindow(
  count: number,
  rowHeight: number,
  tallRows: readonly TallRow[],
  top: number,
  bottom: number,
): RowWindow {
  const height = Math.max(1, rowHeight);
  const tall = tallRows
    .filter((row) => row.index >= 0 && row.index < count)
    .sort((left, right) => left.index - right.index);

  const offsetOf = (index: number): number => {
    let offset = index * height;
    for (const row of tall) {
      if (row.index >= index) break;
      offset += row.height - height;
    }
    return offset;
  };

  const indexAt = (y: number): number => {
    let extra = 0;
    for (const row of tall) {
      const rowTop = row.index * height + extra;
      if (y < rowTop) break;
      if (y < rowTop + row.height) return row.index;
      extra += row.height - height;
    }
    return Math.floor((y - extra) / height);
  };

  const clamp = (index: number): number => Math.max(0, Math.min(count, index));
  const start = clamp(indexAt(top));
  const end = Math.max(start, clamp(indexAt(bottom) + 1));
  return { start, end, before: offsetOf(start), after: offsetOf(count) - offsetOf(end) };
}
