/**
 * Normalizes an artist/title pair into the comparison key used to recognize
 * legacy Songs entries ("Artist - Title", no beatmapset id prefix).
 * Lowercase, accent-free, punctuation collapsed to single spaces so
 * "EGOIST - Ame, Kimi o Tsurete" and "egoist ame kimi o tsurete" agree.
 */
export function beatmapsetNameKey(artist: string, title: string): string {
  return normalizeBeatmapsetName(`${artist} - ${title}`);
}

export function normalizeBeatmapsetName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics left behind by NFKD
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
