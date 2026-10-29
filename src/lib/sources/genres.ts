import type { Tag } from "../types";

/** AniList's fixed genre vocabulary; other sources are normalised onto it. */
const GENRES: Record<string, true> = {
  Action: true,
  Adventure: true,
  Comedy: true,
  Drama: true,
  Ecchi: true,
  Fantasy: true,
  Hentai: true,
  Horror: true,
  "Mahou Shoujo": true,
  Mecha: true,
  Music: true,
  Mystery: true,
  Psychological: true,
  Romance: true,
  "Sci-Fi": true,
  "Slice of Life": true,
  Sports: true,
  Supernatural: true,
  Thriller: true,
};

const ALIASES: Record<string, string> = {
  "Science Fiction": "Sci-Fi",
  "Magical Girl": "Mahou Shoujo",
  Erotica: "Hentai",
  Suspense: "Thriller",
};

/** Splits a source's free-form labels into AniList genres and tags. */
export function splitGenres(labels: string[]): { genres: string[]; tags: Tag[] } {
  const genres = new Set<string>();
  const tags: Tag[] = [];
  for (const label of labels) {
    const name = Object.hasOwn(ALIASES, label) ? ALIASES[label] : label;
    if (Object.hasOwn(GENRES, name)) genres.add(name);
    else tags.push({ name, rank: 100 });
  }
  return { genres: [...genres], tags };
}
