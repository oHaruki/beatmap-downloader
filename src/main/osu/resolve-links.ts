import type { BeatmapLinkRef } from "@shared/beatmap-links";
import type { DownloadJob, LinkResolveResult } from "@shared/types";
import type { BeatmapLookup, BeatmapsetName } from "./api";

const BEATMAP_LOOKUP_BATCH = 50;
const NAME_LOOKUP_CONCURRENCY = 4;

export interface ResolveLinksDeps {
  lookupBeatmaps: (ids: number[], signal?: AbortSignal) => Promise<Map<number, BeatmapLookup>>;
  lookupBeatmapsetName: (id: number, signal?: AbortSignal) => Promise<BeatmapsetName | null>;
}

function jobFileName(id: number, name: BeatmapsetName | null | undefined): string {
  return name ? `${name.artist} - ${name.title} (${name.creator})` : `beatmapset ${id}`;
}

function failureReason(error: unknown, signal: AbortSignal | undefined): string {
  if (signal?.aborted) throw error;
  return error instanceof Error && error.message ? error.message : "unknown error";
}

/**
 * Turns parsed links into download jobs, in paste order. Difficulty links are
 * mapped to their set through the osu! API. Sets whose name cannot be looked
 * up are still queued under a generic name, since mirrors often keep sets osu!
 * no longer lists and set IDs do not need the API at all.
 */
export async function resolveBeatmapLinks(
  refs: BeatmapLinkRef[],
  deps: ResolveLinksDeps,
  signal?: AbortSignal,
): Promise<LinkResolveResult> {
  const problems: string[] = [];
  const beatmapIds = refs.filter((ref) => ref.kind === "beatmap").map((ref) => ref.id);
  const beatmaps = new Map<number, BeatmapLookup>();
  let beatmapLookupFailed = false;
  try {
    for (let start = 0; start < beatmapIds.length; start += BEATMAP_LOOKUP_BATCH) {
      const found = await deps.lookupBeatmaps(beatmapIds.slice(start, start + BEATMAP_LOOKUP_BATCH), signal);
      for (const [id, lookup] of found) beatmaps.set(id, lookup);
    }
  } catch (error) {
    beatmapLookupFailed = true;
    problems.push(`Could not look up difficulty links: ${failureReason(error, signal)}`);
  }

  const setIds = new Set<number>();
  const names = new Map<number, BeatmapsetName>();
  for (const ref of refs) {
    if (ref.kind === "set") {
      setIds.add(ref.id);
      continue;
    }
    const lookup = beatmaps.get(ref.id);
    if (!lookup) {
      if (!beatmapLookupFailed) problems.push(`Difficulty ${ref.id} was not found on osu!.`);
      continue;
    }
    setIds.add(lookup.beatmapsetId);
    if (lookup.name && !names.has(lookup.beatmapsetId)) names.set(lookup.beatmapsetId, lookup.name);
  }

  const unnamed = [...setIds].filter((id) => !names.has(id));
  let next = 0;
  let nameLookupError: string | null = null;
  const lookupWorker = async (): Promise<void> => {
    while (next < unnamed.length && nameLookupError === null) {
      const id = unnamed[next++];
      try {
        const name = await deps.lookupBeatmapsetName(id, signal);
        if (name) names.set(id, name);
      } catch (error) {
        nameLookupError ??= failureReason(error, signal);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(NAME_LOOKUP_CONCURRENCY, unnamed.length) }, lookupWorker));
  if (nameLookupError) problems.push(`Some maps will be saved without their title: ${nameLookupError}`);

  const jobs: DownloadJob[] = [...setIds].map((id) => ({ beatmapsetId: id, fileName: jobFileName(id, names.get(id)) }));
  return { jobs, problems };
}
