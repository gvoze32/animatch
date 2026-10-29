import type { Anime } from "./types";

// Trailing installment markers: "Season 2", "2nd Season", "Part 2", "Cour 2",
// "Final Season", "II", a bare sequel number, or a "(2011)" year suffix.
const INSTALLMENT_SUFFIX =
  /[\s:\-–]+(\(\d{4}\)|season\s*\d+|\d+(st|nd|rd|th)\s+season|part\s*\d+|cour\s*\d+|(the\s+)?final(\s+season)?|ii+|[2-9])$/i;

/** Title with trailing season/part markers removed, used as a fallback franchise key. */
export function titleRoot(anime: Anime): string {
  let title = (anime.title.romaji || anime.title.english || "").toLowerCase().trim();
  for (let previous = ""; previous !== title; ) {
    previous = title;
    title = title.replace(INSTALLMENT_SUFFIX, "").trim();
  }
  return title;
}

function franchiseKeys(anime: Anime): string[] {
  const keys = (anime.franchiseIds ?? []).map((id) => `al:${id}`);
  if (anime.ids.anilist !== undefined) keys.push(`al:${anime.ids.anilist}`);
  if (anime.ids.mal !== undefined) keys.push(`mal:${anime.ids.mal}`);
  const root = titleRoot(anime);
  // Very short roots ("k", "x") would join unrelated shows.
  if (root.length >= 4) keys.push(`title:${root}`);
  return keys;
}

/**
 * Assigns a franchise group number to every anime. Two entries share a group
 * when they are linked by AniList relations (directly or through any chain of
 * shared related ids) or have the same title root.
 */
export function groupFranchises(items: Anime[]): number[] {
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(key, root);
    return root;
  };
  const add = (key: string) => {
    if (!parent.has(key)) parent.set(key, key);
  };

  const keysPerItem = items.map(franchiseKeys);
  for (const keys of keysPerItem) {
    keys.forEach(add);
    for (const key of keys.slice(1)) parent.set(find(key), find(keys[0]));
  }

  const groups = new Map<string, number>();
  return keysPerItem.map((keys, index) => {
    if (keys.length === 0) return -1 - index; // unique, ungroupable
    const root = find(keys[0]);
    if (!groups.has(root)) groups.set(root, groups.size);
    return groups.get(root)!;
  });
}
