import { fetchJson, RateLimiter, type RequestOptions } from "../http";
import type { Anime, SearchOptions } from "../types";
import { splitGenres } from "./genres";

const BASE_URL = "https://api.jikan.moe/v4";
// Jikan allows 3 requests/second per client.
const limiter = new RateLimiter(350);

interface JikanNamed {
  name: string;
}

interface JikanImages {
  jpg?: { image_url?: string | null; large_image_url?: string | null };
  webp?: { image_url?: string | null; large_image_url?: string | null };
}

interface JikanAnime {
  mal_id: number;
  images: JikanImages;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  type: string | null;
  episodes: number | null;
  status: string | null;
  rating: string | null;
  score: number | null;
  popularity: number | null;
  synopsis: string | null;
  year: number | null;
  aired?: { prop?: { from?: { year?: number | null } } };
  studios?: JikanNamed[];
  genres?: JikanNamed[];
  explicit_genres?: JikanNamed[];
  themes?: JikanNamed[];
  demographics?: JikanNamed[];
}

export interface JikanRecommendation {
  malId: number;
  title: string;
  coverImage?: string;
  votes: number;
}

const STATUS: Record<string, Anime["status"]> = {
  "Finished Airing": "FINISHED",
  "Currently Airing": "RELEASING",
  "Not yet aired": "NOT_YET_RELEASED",
};

function pickImage(images: JikanImages): string | undefined {
  return (
    images.webp?.large_image_url ??
    images.jpg?.large_image_url ??
    images.jpg?.image_url ??
    undefined
  );
}

export function mapJikanAnime(anime: JikanAnime): Anime {
  const names = (list?: JikanNamed[]) => list?.map((item) => item.name) ?? [];
  const explicit = names(anime.explicit_genres);
  const { genres, tags } = splitGenres([
    ...names(anime.genres),
    ...explicit,
    ...names(anime.themes),
    ...names(anime.demographics),
  ]);

  return {
    id: `mal-${anime.mal_id}`,
    ids: { mal: anime.mal_id },
    title: {
      english: anime.title_english ?? undefined,
      romaji: anime.title,
      native: anime.title_japanese ?? undefined,
    },
    description: anime.synopsis ?? undefined,
    coverImage: pickImage(anime.images),
    // MAL scores are 0-10.
    averageScore: anime.score ? Math.round(anime.score * 10) : undefined,
    episodes: anime.episodes ?? undefined,
    format: anime.type ?? undefined,
    status: anime.status ? STATUS[anime.status] : undefined,
    year: anime.year ?? anime.aired?.prop?.from?.year ?? undefined,
    genres,
    tags,
    studios: names(anime.studios),
    isAdult: anime.rating?.startsWith("Rx") === true || explicit.includes("Hentai"),
  };
}

function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return limiter.schedule(() => fetchJson<T>(`${BASE_URL}${path}`, {}, options));
}

export async function searchJikan(
  query: string,
  { limit = 20, includeAdult = false }: SearchOptions = {},
  options?: RequestOptions,
): Promise<Anime[]> {
  const params = new URLSearchParams({ q: query, limit: String(Math.min(limit, 25)) });
  // `sfw` drops Rx/hentai entries server-side.
  if (!includeAdult) params.set("sfw", "true");
  const body = await get<{ data: JikanAnime[] }>(`/anime?${params}`, options);
  return body.data.map(mapJikanAnime);
}

export async function getJikanRecommendations(
  malId: number,
  options?: RequestOptions,
): Promise<JikanRecommendation[]> {
  const body = await get<{
    data: { entry: { mal_id: number; title: string; images: JikanImages }; votes: number }[];
  }>(`/anime/${malId}/recommendations`, options);
  return body.data.map(({ entry, votes }) => ({
    malId: entry.mal_id,
    title: entry.title,
    coverImage: pickImage(entry.images),
    votes,
  }));
}

export async function getJikanAnime(malId: number, options?: RequestOptions): Promise<Anime> {
  const body = await get<{ data: JikanAnime }>(`/anime/${malId}`, options);
  return mapJikanAnime(body.data);
}
