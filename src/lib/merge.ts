import { toRef } from "./anime";
import type { Anime, ExternalIds, RecommendationCandidate, SourceName } from "./types";

export function sharesId(a: ExternalIds, b: ExternalIds): boolean {
  return (Object.keys(a) as SourceName[]).some((s) => a[s] !== undefined && a[s] === b[s]);
}

function conflicts(a: ExternalIds, b: ExternalIds): boolean {
  return (Object.keys(a) as SourceName[]).some(
    (s) => a[s] !== undefined && b[s] !== undefined && a[s] !== b[s],
  );
}

/** Loose identity for titles that came without cross-source ids. */
export function titleKey(anime: Anime): string {
  const title = (anime.title.romaji || anime.title.english || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${title}|${anime.year ?? ""}`;
}

/**
 * `primary` wins every field it has; `extra` only fills gaps. Arrays count as
 * missing when empty so Kitsu/Jikan can backfill sparse records.
 */
function mergePair(primary: Anime, extra: Anime): Anime {
  const ids = { ...extra.ids, ...primary.ids };
  return {
    id: toRef(ids),
    ids,
    title: { ...extra.title, ...stripUndefined(primary.title) },
    description: primary.description ?? extra.description,
    coverImage: primary.coverImage ?? extra.coverImage,
    accentColor: primary.accentColor ?? extra.accentColor,
    bannerImage: primary.bannerImage ?? extra.bannerImage,
    averageScore: primary.averageScore ?? extra.averageScore,
    popularity: primary.popularity ?? extra.popularity,
    episodes: primary.episodes ?? extra.episodes,
    format: primary.format ?? extra.format,
    status: primary.status ?? extra.status,
    year: primary.year ?? extra.year,
    genres: primary.genres.length ? primary.genres : extra.genres,
    tags: primary.tags.length ? primary.tags : extra.tags,
    studios: primary.studios.length ? primary.studios : extra.studios,
    isAdult: primary.isAdult || extra.isAdult,
    franchiseIds: primary.franchiseIds ?? extra.franchiseIds,
  };
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

interface Group {
  anime: Anime;
  key: string;
}

/** Index of the group `anime` belongs to, or -1. Id matches beat title matches. */
function findGroup(groups: Group[], anime: Anime): number {
  const byId = groups.findIndex((g) => sharesId(g.anime.ids, anime.ids));
  if (byId !== -1) return byId;
  const key = titleKey(anime);
  return groups.findIndex((g) => g.key === key && !conflicts(g.anime.ids, anime.ids));
}

// Reciprocal-rank-fusion constant; small because each list holds ≤ 25 items.
const RRF_K = 10;

/**
 * Merges per-source search results (each ordered by relevance, sources in
 * priority order) into one list ranked by reciprocal rank fusion.
 */
export function mergeSearchResults(lists: Anime[][]): Anime[] {
  const groups: (Group & { score: number })[] = [];
  for (const list of lists) {
    list.forEach((anime, rank) => {
      const index = findGroup(groups, anime);
      const contribution = 1 / (RRF_K + rank + 1);
      if (index === -1) {
        groups.push({ anime, key: titleKey(anime), score: contribution });
        return;
      }
      const group = groups[index];
      group.anime = mergePair(group.anime, anime);
      group.score += contribution;
    });
  }
  return groups.sort((a, b) => b.score - a.score).map((g) => g.anime);
}

/** De-duplicates candidates from several sources, summing their votes. */
export function mergeCandidates(lists: RecommendationCandidate[][]): RecommendationCandidate[] {
  const merged: RecommendationCandidate[] = [];
  for (const candidate of lists.flat()) {
    const existing = merged.find((m) => sharesId(m.anime.ids, candidate.anime.ids));
    if (!existing) {
      merged.push({ ...candidate });
      continue;
    }
    existing.anime = mergePair(existing.anime, candidate.anime);
    existing.votes += Math.max(0, candidate.votes);
  }
  return merged;
}
