import { toRef } from "./anime";
import { TtlCache } from "./cache";
import { isAbortError, type RequestOptions } from "./http";
import { mergeCandidates, mergeSearchResults } from "./merge";
import { rankRecommendations, type RankedRecommendations } from "./recommend";
import {
  getAniListByMalIds,
  getAniListDetails,
  getTrendingAniList,
  searchAniList,
  type AniListDetails,
} from "./sources/anilist";
import { getJikanAnime, getJikanRecommendations, searchJikan, type JikanRecommendation } from "./sources/jikan";
import { getKitsuAnime, searchKitsu } from "./sources/kitsu";
import type {
  Anime,
  ExternalIds,
  RecommendationCandidate,
  SearchOptions,
  SourceName,
} from "./types";

export interface SearchResult {
  results: Anime[];
  /** Sources that failed; results are partial when non-empty. */
  failedSources: SourceName[];
}

export interface RecommendationsResult extends RankedRecommendations {
  anime: Anime;
  failedSources: SourceName[];
}

export class AllSourcesFailedError extends Error {
  constructor(public readonly causes: unknown[]) {
    super("Every anime source failed to respond");
    this.name = "AllSourcesFailedError";
  }
}

const searchCache = new TtlCache<SearchResult>(15 * 60_000);
const recommendationsCache = new TtlCache<RecommendationsResult>(30 * 60_000);
const trendingCache = new TtlCache<Anime[]>(60 * 60_000, 1);

/** Trending titles for the landing page (AniList only; SFW). */
export async function getTrending(options: RequestOptions = {}): Promise<Anime[]> {
  const cached = trendingCache.get("trending");
  if (cached) return cached;
  const trending = await getTrendingAniList(15, options);
  trendingCache.set("trending", trending);
  return trending;
}

const SEARCH_LIMIT = 20;

// After the first source answers, slower ones get this long before being dropped,
// so one unreachable API can't stall the UI until its full timeout.
const GRACE_MS = 2500;

type SourceTasks<T extends readonly unknown[]> = {
  [K in keyof T]: (options: RequestOptions) => Promise<T[K]>;
};
type SettledTuple<T extends readonly unknown[]> = { [K in keyof T]: PromiseSettledResult<T[K]> };

/** `Promise.allSettled` over source calls, cutting stragglers off `GRACE_MS` after the first success. */
async function settleWithGrace<T extends readonly unknown[]>(
  tasks: SourceTasks<T>,
  { signal }: RequestOptions,
): Promise<SettledTuple<T>> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) forwardAbort();
  signal?.addEventListener("abort", forwardAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const startGrace = () => {
    timer ??= setTimeout(
      () => controller.abort(new DOMException("Source too slow", "TimeoutError")),
      GRACE_MS,
    );
  };

  try {
    const settled = await Promise.allSettled(
      tasks.map((task: (options: RequestOptions) => Promise<unknown>) =>
        task({ signal: controller.signal }).then((value) => {
          startGrace();
          return value;
        }),
      ),
    );
    return settled as SettledTuple<T>;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
    signal?.throwIfAborted();
  }
}

/** Searches every source in parallel; tolerates individual source failures. */
export async function searchAnime(
  query: string,
  { includeAdult = false }: Pick<SearchOptions, "includeAdult"> = {},
  options: RequestOptions = {},
): Promise<SearchResult> {
  const normalized = query.trim();
  const key = `${normalized.toLowerCase()}|${includeAdult}`;
  const cached = searchCache.get(key);
  if (cached) return cached;

  const searchOptions = { limit: SEARCH_LIMIT, includeAdult };
  const sources: SourceName[] = ["anilist", "mal", "kitsu"];
  const settled = await settleWithGrace<[Anime[], Anime[], Anime[]]>(
    [
      (o) => searchAniList(normalized, searchOptions, o),
      (o) => searchJikan(normalized, searchOptions, o),
      (o) => searchKitsu(normalized, searchOptions, o),
    ],
    options,
  );

  const failedSources = sources.filter((_, i) => settled[i].status === "rejected");
  if (failedSources.length === sources.length) {
    throw new AllSourcesFailedError(settled.map((s) => (s as PromiseRejectedResult).reason));
  }

  const lists = settled.map((s) => (s.status === "fulfilled" ? s.value : []));
  const result = { results: mergeSearchResults(lists).slice(0, SEARCH_LIMIT), failedSources };
  if (failedSources.length === 0) searchCache.set(key, result);
  return result;
}

/**
 * Turns MAL recommendations into candidates. Entries AniList didn't already
 * return are enriched through one AniList batch query when `enrich` is set;
 * otherwise (or on failure) they keep Jikan's sparse title/cover data.
 */
async function resolveJikanCandidates(
  recommendations: JikanRecommendation[],
  known: RecommendationCandidate[],
  enrich: boolean,
  options: RequestOptions,
): Promise<RecommendationCandidate[]> {
  const knownMal = new Set(known.flatMap((c) => (c.anime.ids.mal ? [c.anime.ids.mal] : [])));
  const missing = recommendations.filter((r) => !knownMal.has(r.malId)).slice(0, 20);

  let enriched = new Map<number, Anime>();
  if (enrich && missing.length > 0) {
    try {
      const found = await getAniListByMalIds(missing.map((r) => r.malId), options);
      enriched = new Map(found.map((anime) => [anime.ids.mal!, anime]));
    } catch (error) {
      if (isAbortError(error)) throw error;
    }
  }

  return recommendations.map((r) => ({
    votes: r.votes,
    anime: enriched.get(r.malId) ?? {
      id: `mal-${r.malId}`,
      ids: { mal: r.malId },
      title: { romaji: r.title },
      coverImage: r.coverImage,
      genres: [],
      tags: [],
      studios: [],
      isAdult: false,
    },
  }));
}

/**
 * Loads an anime (by any of its source ids) and ranks recommendations from
 * AniList and MyAnimeList community data.
 */
export async function getRecommendations(
  knownIds: ExternalIds,
  { includeAdult = false }: Pick<SearchOptions, "includeAdult"> = {},
  options: RequestOptions = {},
): Promise<RecommendationsResult> {
  let ids = { ...knownIds };
  const key = `${toRef(ids)}|${includeAdult}`;
  const cached = recommendationsCache.get(key);
  if (cached) return cached;

  const failedSources: SourceName[] = [];
  let kitsuAnime: Anime | null = null;

  if (ids.anilist === undefined && ids.mal === undefined && ids.kitsu !== undefined) {
    kitsuAnime = await getKitsuAnime(ids.kitsu, options);
    if (!kitsuAnime) throw new Error("Anime not found");
    ids = { ...kitsuAnime.ids, ...ids };
  }

  // AniList and (when the MAL id is already known) Jikan run in parallel.
  const knownMal = ids.mal;
  const [aniListResult, earlyJikanResult] = await settleWithGrace<
    [AniListDetails | null, JikanRecommendation[]]
  >(
    [
      (o) => (ids.anilist !== undefined || ids.mal !== undefined ? getAniListDetails(ids, o) : Promise.resolve(null)),
      (o) => (knownMal !== undefined ? getJikanRecommendations(knownMal, o) : Promise.resolve([])),
    ],
    options,
  );

  let anime: Anime | undefined;
  let aniListCandidates: RecommendationCandidate[] = [];
  if (aniListResult.status === "rejected") failedSources.push("anilist");
  else if (aniListResult.value) {
    ({ anime, candidates: aniListCandidates } = aniListResult.value);
  }

  const malId = anime?.ids.mal ?? knownMal;
  let jikanRecommendations: JikanRecommendation[] = [];
  try {
    if (earlyJikanResult.status === "rejected") throw earlyJikanResult.reason;
    jikanRecommendations =
      knownMal === undefined && malId !== undefined
        ? // MAL id only became known through AniList; keep the follow-up short.
          await getJikanRecommendations(malId, { signal: options.signal, timeoutMs: GRACE_MS })
        : earlyJikanResult.value;
  } catch (error) {
    if (isAbortError(error)) throw error;
    failedSources.push("mal");
  }

  if (!anime && malId !== undefined && !failedSources.includes("mal")) {
    try {
      anime = await getJikanAnime(malId, options);
    } catch (error) {
      if (isAbortError(error)) throw error;
      failedSources.push("mal");
    }
  }
  anime ??= kitsuAnime ?? undefined;
  if (!anime) {
    throw failedSources.length ? new AllSourcesFailedError([]) : new Error("Anime not found");
  }

  const jikanCandidates = await resolveJikanCandidates(
    jikanRecommendations,
    aniListCandidates,
    !failedSources.includes("anilist"),
    options,
  );

  const result: RecommendationsResult = {
    anime,
    ...rankRecommendations(anime, mergeCandidates([aniListCandidates, jikanCandidates]), { includeAdult }),
    failedSources: [...new Set(failedSources)],
  };
  if (result.failedSources.length === 0) recommendationsCache.set(key, result);
  return result;
}
