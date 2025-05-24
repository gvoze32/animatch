import { GraphQLClient } from "graphql-request";

// AniList GraphQL endpoint
const ANILIST_ENDPOINT = "https://graphql.anilist.co";

// Create GraphQL client
export const anilistClient = new GraphQLClient(ANILIST_ENDPOINT);

// GraphQL queries
export const SEARCH_ANIME_QUERY = `
  query SearchAnime($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        perPage
        currentPage
        lastPage
        hasNextPage
      }
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title {
          romaji
          english
          native
        }
        description
        coverImage {
          large
          medium
        }
        bannerImage
        averageScore
        episodes
        status
        startDate {
          year
        }
        genres
        tags {
          name
          rank
        }
        studios(isMain: true) {
          nodes {
            name
          }
        }
      }
    }
  }
`;

export const GET_ANIME_DETAILS_QUERY = `
  query GetAnimeDetails($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title {
        romaji
        english
        native
      }
      description
      coverImage {
        extraLarge
        large
        medium
      }
      bannerImage
      averageScore
      episodes
      duration
      status
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      season
      seasonYear
      genres
      tags {
        name
        description
        rank
        isMediaSpoiler
      }
      studios(isMain: true) {
        nodes {
          name
        }
      }
      staff(sort: RELEVANCE, perPage: 10) {
        nodes {
          name {
            full
          }
          primaryOccupations
        }
      }
      relations {
        edges {
          relationType
          node {
            id
            title {
              romaji
              english
            }
            coverImage {
              medium
            }
            type
          }
        }
      }
      recommendations(sort: RATING_DESC, perPage: 10) {
        nodes {
          rating
          mediaRecommendation {
            id
            title {
              romaji
              english
            }
            coverImage {
              large
              medium
            }
            averageScore
            genres
            description
          }
        }
      }
    }
  }
`;

export const GET_RECOMMENDATIONS_QUERY = `
  query GetRecommendations($mediaId: Int, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        hasNextPage
      }
      recommendations(mediaId: $mediaId, sort: RATING_DESC) {
        rating
        userRating
        mediaRecommendation {
          id
          title {
            romaji
            english
            native
          }
          description
          coverImage {
            large
            medium
          }
          averageScore
          episodes
          status
          startDate {
            year
          }
          genres
          tags {
            name
            rank
          }
        }
      }
    }
  }
`;

// Types
export interface AnimeTitle {
  romaji: string;
  english?: string;
  native?: string;
}

export interface CoverImage {
  extraLarge?: string;
  large?: string;
  medium?: string;
}

export interface AnimeTag {
  name: string;
  description?: string;
  rank?: number;
  isMediaSpoiler?: boolean;
}

export interface Studio {
  name: string;
}

export interface Staff {
  name: {
    full: string;
  };
  primaryOccupations: string[];
}

export interface Anime {
  id: number;
  title: AnimeTitle;
  description?: string;
  coverImage: CoverImage;
  bannerImage?: string;
  averageScore?: number;
  episodes?: number;
  duration?: number;
  status?: string;
  startDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  endDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  season?: string;
  seasonYear?: number;
  genres: string[];
  tags: AnimeTag[];
  studios?: {
    nodes: Studio[];
  };
  staff?: {
    nodes: Staff[];
  };
}

export interface Recommendation {
  rating: number;
  userRating?: number;
  mediaRecommendation: Anime;
}

export interface SearchResponse {
  Page: {
    pageInfo: {
      total: number;
      perPage: number;
      currentPage: number;
      lastPage: number;
      hasNextPage: boolean;
    };
    media: Anime[];
  };
}

export interface RecommendationsResponse {
  Page: {
    pageInfo: {
      total: number;
      currentPage: number;
      hasNextPage: boolean;
    };
    recommendations: Recommendation[];
  };
}

export interface AnimeDetailsResponse {
  Media: Anime & {
    relations: {
      edges: Array<{
        relationType: string;
        node: {
          id: number;
          title: AnimeTitle;
          coverImage: CoverImage;
          type: string;
        };
      }>;
    };
    recommendations: {
      nodes: Recommendation[];
    };
  };
}

// API functions
export async function searchAnime(
  query: string,
  page = 1,
  perPage = 20
): Promise<SearchResponse> {
  return await anilistClient.request(SEARCH_ANIME_QUERY, {
    search: query,
    page,
    perPage,
  });
}

export async function getAnimeDetails(
  id: number
): Promise<AnimeDetailsResponse> {
  return await anilistClient.request(GET_ANIME_DETAILS_QUERY, { id });
}

export async function getRecommendations(
  mediaId: number,
  page = 1,
  perPage = 10
): Promise<RecommendationsResponse> {
  return await anilistClient.request(GET_RECOMMENDATIONS_QUERY, {
    mediaId,
    page,
    perPage,
  });
}

// Utility functions
export function getAnimeTitle(anime: Anime): string {
  return (
    anime.title.english ||
    anime.title.romaji ||
    anime.title.native ||
    "Unknown Title"
  );
}

export function formatScore(score?: number): string {
  if (!score) return "N/A";
  return `${score}%`;
}

export function formatEpisodes(episodes?: number): string {
  if (!episodes) return "Unknown";
  return `${episodes} episodes`;
}

export function getGenreColor(genre: string): string {
  const genreColors: Record<string, string> = {
    Action: "bg-red-500",
    Adventure: "bg-green-500",
    Comedy: "bg-yellow-500",
    Drama: "bg-blue-500",
    Fantasy: "bg-purple-500",
    Horror: "bg-gray-800",
    Romance: "bg-pink-500",
    "Sci-Fi": "bg-cyan-500",
    Thriller: "bg-orange-500",
    Mystery: "bg-indigo-500",
    Supernatural: "bg-violet-500",
    "Slice of Life": "bg-emerald-500",
  };

  return genreColors[genre] || "bg-gray-500";
}
