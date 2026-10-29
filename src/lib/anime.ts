import type { Anime, AnimeStatus, ExternalIds, SourceName } from "./types";

const SOURCE_PRIORITY: SourceName[] = ["anilist", "mal", "kitsu"];

/** Reference for the richest source the anime is known on, e.g. `anilist-20`. */
export function toRef(ids: ExternalIds): string {
  const source = SOURCE_PRIORITY.find((s) => ids[s] !== undefined);
  if (!source) throw new Error("Anime has no known source id");
  return `${source}-${ids[source]}`;
}

export function parseRef(ref: string): ExternalIds | null {
  const match = /^(anilist|mal|kitsu)-(\d+)$/.exec(ref);
  if (!match) return null;
  return { [match[1] as SourceName]: Number(match[2]) };
}

export function getTitle(anime: Anime): string {
  return anime.title.english || anime.title.romaji || anime.title.native || "Unknown title";
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

/** Plain text from the HTML-ish descriptions AniList/Kitsu return. */
export function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => ENTITIES[name.toLowerCase()] ?? entity)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function formatScore(score?: number): string | null {
  return score ? `${Math.round(Math.min(100, Math.max(0, score)))}%` : null;
}

const STATUS_LABELS: Record<AnimeStatus, string> = {
  FINISHED: "Finished",
  RELEASING: "Airing",
  NOT_YET_RELEASED: "Upcoming",
  CANCELLED: "Cancelled",
  HIATUS: "Hiatus",
};

/** "2023 · TV · 28 eps" style subtitle; skips unknown parts. */
export function formatMeta(anime: Anime): string {
  const episodes =
    anime.episodes !== undefined
      ? `${anime.episodes} ep${anime.episodes === 1 ? "" : "s"}`
      : anime.status
        ? STATUS_LABELS[anime.status]
        : undefined;
  return [anime.year, anime.format?.replace(/_/g, " "), episodes].filter(Boolean).join(" · ");
}
