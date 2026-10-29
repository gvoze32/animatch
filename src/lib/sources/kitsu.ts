import { fetchJson, HttpError, type RequestOptions } from "../http";
import type { Anime, ExternalIds, SearchOptions } from "../types";
import { splitGenres } from "./genres";

const BASE_URL = "https://kitsu.app/api/edge";

interface KitsuRelationship {
  data?: { type: string; id: string }[];
}

interface KitsuAnime {
  id: string;
  attributes: {
    canonicalTitle: string | null;
    titles: Record<string, string | null> | null;
    synopsis: string | null;
    posterImage: { large?: string; medium?: string } | null;
    coverImage: { large?: string } | null;
    averageRating: string | null;
    episodeCount: number | null;
    subtype: string | null;
    status: string | null;
    startDate: string | null;
    nsfw: boolean | null;
    ageRating: string | null;
  };
  relationships: { categories?: KitsuRelationship; mappings?: KitsuRelationship };
}

type KitsuIncluded =
  | { type: "categories"; id: string; attributes: { title: string } }
  | { type: "mappings"; id: string; attributes: { externalSite: string; externalId: string } };

interface KitsuResponse {
  data: KitsuAnime[];
  included?: KitsuIncluded[];
}

const STATUS: Record<string, Anime["status"]> = {
  finished: "FINISHED",
  current: "RELEASING",
  upcoming: "NOT_YET_RELEASED",
  tba: "NOT_YET_RELEASED",
  unreleased: "NOT_YET_RELEASED",
};

const MAPPING_SITES: Record<string, keyof ExternalIds> = {
  "myanimelist/anime": "mal",
  "anilist/anime": "anilist",
};

export function mapKitsuResponse(body: KitsuResponse): Anime[] {
  const included = new Map((body.included ?? []).map((item) => [`${item.type}:${item.id}`, item]));
  const related = (anime: KitsuAnime, key: "categories" | "mappings") =>
    (anime.relationships[key]?.data ?? []).flatMap((ref) => {
      const item = included.get(`${ref.type}:${ref.id}`);
      return item ? [item] : [];
    });

  return body.data.map((anime) => {
    const a = anime.attributes;
    const ids: ExternalIds = { kitsu: Number(anime.id) };
    for (const item of related(anime, "mappings")) {
      if (item.type !== "mappings") continue;
      const site = MAPPING_SITES[item.attributes.externalSite];
      const id = Number(item.attributes.externalId);
      if (site && Number.isInteger(id) && ids[site] === undefined) ids[site] = id;
    }
    const { genres, tags } = splitGenres(
      related(anime, "categories").flatMap((item) =>
        item.type === "categories" ? [item.attributes.title] : [],
      ),
    );
    const year = a.startDate ? Number.parseInt(a.startDate.slice(0, 4), 10) : Number.NaN;
    const score = a.averageRating ? Number.parseFloat(a.averageRating) : Number.NaN;

    return {
      id: `kitsu-${anime.id}`,
      ids,
      title: {
        english: a.titles?.en ?? a.titles?.en_us ?? undefined,
        romaji: a.titles?.en_jp ?? a.canonicalTitle ?? undefined,
        native: a.titles?.ja_jp ?? undefined,
      },
      description: a.synopsis ?? undefined,
      coverImage: a.posterImage?.large ?? a.posterImage?.medium,
      bannerImage: a.coverImage?.large,
      averageScore: Number.isNaN(score) ? undefined : Math.round(score),
      episodes: a.episodeCount ?? undefined,
      format: a.subtype?.toUpperCase(),
      status: a.status ? STATUS[a.status] : undefined,
      year: Number.isNaN(year) ? undefined : year,
      genres,
      tags,
      studios: [],
      isAdult: a.nsfw === true || a.ageRating === "R18",
    };
  });
}

const ANIME_FIELDS = [
  "canonicalTitle",
  "titles",
  "synopsis",
  "posterImage",
  "coverImage",
  "averageRating",
  "episodeCount",
  "subtype",
  "status",
  "startDate",
  "nsfw",
  "ageRating",
  "categories",
  "mappings",
].join(",");

export async function searchKitsu(
  query: string,
  { limit = 20, includeAdult = false }: SearchOptions = {},
  options?: RequestOptions,
): Promise<Anime[]> {
  const params = new URLSearchParams({
    "filter[text]": query,
    "page[limit]": String(Math.min(limit, 20)),
    include: "categories,mappings",
    "fields[anime]": ANIME_FIELDS,
    "fields[categories]": "title",
    "fields[mappings]": "externalSite,externalId",
  });
  const body = await fetchJson<KitsuResponse>(
    `${BASE_URL}/anime?${params}`,
    { headers: { Accept: "application/vnd.api+json" } },
    options,
  );
  const results = mapKitsuResponse(body);
  return includeAdult ? results : results.filter((anime) => !anime.isAdult);
}

/** Single anime by Kitsu id; mainly used to discover its AniList/MAL ids. */
export async function getKitsuAnime(id: number, options?: RequestOptions): Promise<Anime | null> {
  const params = new URLSearchParams({
    include: "categories,mappings",
    "fields[anime]": ANIME_FIELDS,
    "fields[categories]": "title",
    "fields[mappings]": "externalSite,externalId",
  });
  try {
    const body = await fetchJson<{ data: KitsuAnime; included?: KitsuIncluded[] }>(
      `${BASE_URL}/anime/${id}?${params}`,
      { headers: { Accept: "application/vnd.api+json" } },
      options,
    );
    return mapKitsuResponse({ data: [body.data], included: body.included })[0] ?? null;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
