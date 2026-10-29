import { fetchJson, HttpError, type RequestOptions } from "../http";
import type { Anime, AnimeStatus, RecommendationCandidate, SearchOptions } from "../types";

const ENDPOINT = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  description(asHtml: false)
  coverImage { extraLarge large color }
  bannerImage
  averageScore
  popularity
  episodes
  format
  status
  seasonYear
  startDate { year }
  genres
  tags { name rank category isMediaSpoiler }
  studios(isMain: true) { nodes { name } }
  isAdult
  relations { edges { relationType(version: 2) node { id type } } }
`;

/** Relation types that mean "same story/franchise" (not adaptations or cameo crossovers). */
const FRANCHISE_RELATIONS: Record<string, true> = {
  SEQUEL: true,
  PREQUEL: true,
  PARENT: true,
  SIDE_STORY: true,
  SPIN_OFF: true,
  ALTERNATIVE: true,
  SUMMARY: true,
  COMPILATION: true,
  CONTAINS: true,
};

interface AniListMedia {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  description: string | null;
  coverImage: { extraLarge: string | null; large: string | null; color: string | null } | null;
  bannerImage: string | null;
  averageScore: number | null;
  popularity: number | null;
  episodes: number | null;
  format: string | null;
  status: AnimeStatus | null;
  seasonYear: number | null;
  startDate: { year: number | null } | null;
  genres: string[] | null;
  tags: { name: string; rank: number | null; category: string | null; isMediaSpoiler: boolean }[] | null;
  studios: { nodes: { name: string }[] } | null;
  isAdult: boolean | null;
  relations: {
    edges: { relationType: string | null; node: { id: number; type: string | null } | null }[];
  } | null;
}

interface AniListMediaWithRecommendations extends AniListMedia {
  recommendations: {
    nodes: { rating: number | null; mediaRecommendation: AniListMedia | null }[];
  };
}

async function query<T>(
  document: string,
  variables: Record<string, unknown>,
  options?: RequestOptions,
): Promise<T> {
  const body = await fetchJson<{ data: T }>(
    ENDPOINT,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: document, variables }),
    },
    options,
  );
  return body.data;
}

export function mapAniListMedia(media: AniListMedia): Anime {
  return {
    id: `anilist-${media.id}`,
    ids: { anilist: media.id, ...(media.idMal ? { mal: media.idMal } : {}) },
    title: {
      english: media.title.english ?? undefined,
      romaji: media.title.romaji ?? undefined,
      native: media.title.native ?? undefined,
    },
    description: media.description ?? undefined,
    coverImage: media.coverImage?.extraLarge ?? media.coverImage?.large ?? undefined,
    bannerImage: media.bannerImage ?? undefined,
    accentColor: media.coverImage?.color ?? undefined,
    averageScore: media.averageScore ?? undefined,
    popularity: media.popularity ?? undefined,
    episodes: media.episodes ?? undefined,
    format: media.format ?? undefined,
    status: media.status ?? undefined,
    year: media.seasonYear ?? media.startDate?.year ?? undefined,
    genres: media.genres ?? [],
    tags: (media.tags ?? [])
      .filter((tag) => !tag.isMediaSpoiler)
      .map((tag) => ({
        name: tag.name,
        rank: tag.rank ?? 100,
        ...(tag.category === "Cast-Main Cast" ? { generic: true } : {}),
      })),
    studios: media.studios?.nodes.map((studio) => studio.name) ?? [],
    isAdult: media.isAdult ?? false,
    franchiseIds: (media.relations?.edges ?? []).flatMap((edge) =>
      edge.node?.type === "ANIME" && edge.relationType && Object.hasOwn(FRANCHISE_RELATIONS, edge.relationType)
        ? [edge.node.id]
        : [],
    ),
  };
}

export async function searchAniList(
  search: string,
  { limit = 20, includeAdult = false }: SearchOptions = {},
  options?: RequestOptions,
): Promise<Anime[]> {
  const data = await query<{ Page: { media: AniListMedia[] } }>(
    `query ($search: String, $perPage: Int, $isAdult: Boolean) {
      Page(perPage: $perPage) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: $isAdult) { ${MEDIA_FIELDS} }
      }
    }`,
    // Omitting isAdult (rather than `true`) returns both adult and non-adult titles.
    { search, perPage: limit, ...(includeAdult ? {} : { isAdult: false }) },
    options,
  );
  return data.Page.media.map(mapAniListMedia);
}

export interface AniListDetails {
  anime: Anime;
  candidates: RecommendationCandidate[];
}

/** Anime by AniList or MAL id, together with AniList's community recommendations. */
export async function getAniListDetails(
  id: { anilist?: number; mal?: number },
  options?: RequestOptions,
): Promise<AniListDetails | null> {
  try {
    const data = await query<{ Media: AniListMediaWithRecommendations | null }>(
      `query ($id: Int, $idMal: Int) {
        Media(id: $id, idMal: $idMal, type: ANIME) {
          ${MEDIA_FIELDS}
          recommendations(perPage: 25, sort: [RATING_DESC]) {
            nodes { rating mediaRecommendation { ${MEDIA_FIELDS} } }
          }
        }
      }`,
      id.anilist !== undefined ? { id: id.anilist } : { idMal: id.mal },
      options,
    );
    if (!data.Media) return null;
    return {
      anime: mapAniListMedia(data.Media),
      candidates: data.Media.recommendations.nodes.flatMap((node) =>
        node.mediaRecommendation
          ? [{ anime: mapAniListMedia(node.mediaRecommendation), votes: node.rating ?? 0 }]
          : [],
      ),
    };
  } catch (error) {
    // AniList answers unknown ids with HTTP 404.
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

/** Batch lookup used to give MAL-only recommendations full metadata. */
export async function getAniListByMalIds(
  malIds: number[],
  options?: RequestOptions,
): Promise<Anime[]> {
  if (malIds.length === 0) return [];
  const data = await query<{ Page: { media: AniListMedia[] } }>(
    `query ($ids: [Int]) {
      Page(perPage: 50) { media(idMal_in: $ids, type: ANIME) { ${MEDIA_FIELDS} } }
    }`,
    { ids: malIds.slice(0, 50) },
    options,
  );
  return data.Page.media.map(mapAniListMedia);
}

/** Currently trending titles, for the landing page. */
export async function getTrendingAniList(limit: number, options?: RequestOptions): Promise<Anime[]> {
  const data = await query<{ Page: { media: AniListMedia[] } }>(
    `query ($perPage: Int) {
      Page(perPage: $perPage) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }`,
    { perPage: limit },
    options,
  );
  return data.Page.media.map(mapAniListMedia);
}
