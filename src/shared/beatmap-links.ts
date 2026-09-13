// Pulls beatmap references out of pasted text: osu! links in any of their
// usual shapes, or lines holding nothing but a beatmapset ID (the format
// "Export unfinished IDs" writes).

export interface BeatmapLinkRef {
  /** "set" ids can be downloaded directly, "beatmap" ids name one difficulty
   *  and have to be resolved to their set first. */
  kind: "set" | "beatmap";
  id: number;
}

export interface ParsedBeatmapLinks {
  refs: BeatmapLinkRef[];
  /** Non-empty lines that held neither a link nor a bare ID. */
  unrecognized: string[];
}

export const MAX_LINK_TEXT_LENGTH = 1_000_000;

const LINK_PATTERN = /(?:https?:\/\/)?(?:osu|old|lazer)\.ppy\.sh\/[^\s<>"'`()[\]{},]+/gi;
const ID_PATTERN = /^\d{1,10}$/;

function parseId(value: string | null | undefined): number | null {
  if (!value || !ID_PATTERN.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function refFromLink(link: string): BeatmapLinkRef | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`);
  } catch {
    return null;
  }
  const [section, value] = url.pathname.split("/").filter(Boolean);
  const pathId = parseId(value?.replace(/n$/i, ""));
  switch (section?.toLowerCase()) {
    case "beatmapsets":
    case "s":
    case "d":
      // /beatmapsets/1#osu/2 names the set too, and the set is all we need.
      return pathId ? { kind: "set", id: pathId } : null;
    case "beatmaps":
    case "b":
      return pathId ? { kind: "beatmap", id: pathId } : null;
    case "p": {
      const beatmapId = parseId(url.searchParams.get("b"));
      if (beatmapId) return { kind: "beatmap", id: beatmapId };
      const setId = parseId(url.searchParams.get("s"));
      return setId ? { kind: "set", id: setId } : null;
    }
    default:
      return null;
  }
}

export function parseBeatmapLinks(text: string): ParsedBeatmapLinks {
  const refs: BeatmapLinkRef[] = [];
  const unrecognized: string[] = [];
  const seen = new Set<string>();
  const add = (ref: BeatmapLinkRef): void => {
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };

  for (const rawLine of text.slice(0, MAX_LINK_TEXT_LENGTH).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Only accept a bare ID when it is the whole line, so numbers from a
    // pasted spreadsheet row (BPM, length, star rating) are never mistaken
    // for maps.
    const bareId = parseId(line);
    if (bareId) {
      add({ kind: "set", id: bareId });
      continue;
    }

    let found = false;
    for (const match of line.matchAll(LINK_PATTERN)) {
      const ref = refFromLink(match[0]);
      if (!ref) continue;
      found = true;
      add(ref);
    }
    if (!found) unrecognized.push(line);
  }
  return { refs, unrecognized };
}
