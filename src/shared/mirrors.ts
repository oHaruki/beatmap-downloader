// The download mirrors, in the order they are tried. Shared so the settings
// window lists exactly what the downloader uses.

export const MIRRORS = [
  { id: "nerinyan", name: "Nerinyan", template: "https://api.nerinyan.moe/d/{id}" },
  { id: "catboy", name: "catboy.best", template: "https://catboy.best/d/{id}" },
  { id: "osu-direct", name: "osu.direct", template: "https://osu.direct/api/d/{id}" },
  { id: "beatconnect", name: "Beatconnect", template: "https://beatconnect.io/b/{id}" },
  // No rate limit, but a smaller graveyard catalogue, so it is the last resort.
  { id: "nekoha", name: "mirror.nekoha.moe", template: "https://mirror.nekoha.moe/api/download/{id}" },
] as const;

export type MirrorId = (typeof MIRRORS)[number]["id"];

export function isMirrorId(value: unknown): value is MirrorId {
  return MIRRORS.some((mirror) => mirror.id === value);
}

/**
 * The config stores the mirrors a user switched off rather than the ones that
 * are on, so every mirror starts enabled, including ones added in later
 * versions. Unknown ids are dropped, and a list that would switch off every
 * mirror is ignored because a batch could never download anything.
 */
export function parseDisabledMirrors(value: unknown): MirrorId[] {
  if (!Array.isArray(value)) return [];
  const disabled = MIRRORS.map((mirror) => mirror.id).filter((id) => value.includes(id));
  return disabled.length < MIRRORS.length ? disabled : [];
}

export function enabledMirrorTemplates(disabled: readonly MirrorId[]): string[] {
  return MIRRORS.filter((mirror) => !disabled.includes(mirror.id)).map((mirror) => mirror.template);
}
