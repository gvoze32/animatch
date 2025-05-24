import { GraphQLClient } from "graphql-request";
import type {
  DataSource,
  AnimeData,
  SearchOptions,
  RateLimiter,
} from "./base.js";
import { DataSourceError } from "./base.js";

// Simple rate limiter for AniList
class AniListRateLimiter implements RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 90; // AniList allows 90 requests per minute
  private readonly windowMs = 60000; // 1 minute

  canMakeRequest(): boolean {
    this.cleanOldRequests();
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getWaitTime(): number {
    this.cleanOldRequests();
    if (this.requests.length < this.maxRequests) return 0;

    const oldestRequest = this.requests[0];
    return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
  }

  private cleanOldRequests(): void {
    const cutoff = Date.now() - this.windowMs;
    this.requests = this.requests.filter((time) => time > cutoff);
  }
}

export class AniListDataSource implements DataSource {
  name = "AniList";
  private client: GraphQLClient;
  private rateLimiter = new AniListRateLimiter();

  constructor() {
    this.client = new GraphQLClient("https://graphql.anilist.co");
  }

  private async makeRequest<T>(query: string, variables: any): Promise<T> {
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    try {
      this.rateLimiter.recordRequest();
      return await this.client.request<T>(query, variables);
    } catch (error) {
      throw new DataSourceError(
        `GraphQL request failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async searchAnime(
    query: string,
    options: SearchOptions = {}
  ): Promise<AnimeData[]> {
    // Default to excluding adult content unless explicitly requested
    const includeAdult = options.includeAdult ?? false;

    const searchQuery = `
      query SearchAnime($search: String, $page: Int, $perPage: Int, $genre_in: [String], $seasonYear: Int, $status: MediaStatus, $isAdult: Boolean) {
        Page(page: $page, perPage: $perPage) {
          media(search: $search, type: ANIME, sort: SEARCH_MATCH, genre_in: $genre_in, seasonYear: $seasonYear, status: $status, isAdult: $isAdult) {
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
            popularity
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
            isAdult
          }
        }
      }
    `;

    const variables = {
      search: query,
      page: options.page || 1,
      perPage: options.perPage || 20,
      genre_in: options.genres,
      seasonYear: options.year,
      status: options.status?.toUpperCase(),
      isAdult: includeAdult,
    };

    try {
      const response = await this.makeRequest<any>(searchQuery, variables);
      return response.Page.media.map((anime: any) =>
        this.transformToAnimeData(anime)
      );
    } catch (error) {
      throw new DataSourceError(
        `Search failed for query "${query}"`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getAnimeDetails(id: string): Promise<AnimeData | null> {
    const detailsQuery = `
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
          popularity
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
          relations {
            edges {
              relationType
              node {
                id
                type
              }
            }
          }
          isAdult
        }
      }
    `;

    try {
      const response = await this.makeRequest<any>(detailsQuery, {
        id: parseInt(id),
      });
      return response.Media ? this.transformToAnimeData(response.Media) : null;
    } catch (error) {
      throw new DataSourceError(
        `Failed to get details for anime ID ${id}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getRecommendations(animeId: string): Promise<AnimeData[]> {
    const recommendationsQuery = `
      query GetRecommendations($mediaId: Int, $perPage: Int) {
        Page(perPage: $perPage) {
          recommendations(mediaId: $mediaId, sort: RATING_DESC) {
            rating
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
      }
    `;

    try {
      const response = await this.makeRequest<any>(recommendationsQuery, {
        mediaId: parseInt(animeId),
        perPage: 10,
      });

      return response.Page.recommendations
        .map((rec: any) => rec.mediaRecommendation)
        .filter((anime: any) => anime !== null)
        .map((anime: any) => this.transformToAnimeData(anime));
    } catch (error) {
      throw new DataSourceError(
        `Failed to get recommendations for anime ID ${animeId}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  private transformToAnimeData(anilistAnime: any): AnimeData {
    const confidence = this.calculateConfidence(anilistAnime);

    return {
      id: `anilist-${anilistAnime.id}`,
      sourceId: anilistAnime.id.toString(),
      source: this.name,
      title: {
        english: anilistAnime.title.english,
        romaji: anilistAnime.title.romaji,
        native: anilistAnime.title.native,
        common: anilistAnime.title.english || anilistAnime.title.romaji,
      },
      description: anilistAnime.description,
      coverImage: {
        large:
          anilistAnime.coverImage?.extraLarge || anilistAnime.coverImage?.large,
        medium: anilistAnime.coverImage?.medium,
        small: anilistAnime.coverImage?.medium,
      },
      bannerImage: anilistAnime.bannerImage,
      averageScore: anilistAnime.averageScore,
      popularity: anilistAnime.popularity,
      episodes: anilistAnime.episodes,
      duration: anilistAnime.duration,
      status: this.mapStatus(anilistAnime.status),
      startDate: anilistAnime.startDate,
      endDate: anilistAnime.endDate,
      genres: anilistAnime.genres || [],
      tags: anilistAnime.tags?.map((tag: any) => tag.name) || [],
      isAdult: anilistAnime.isAdult || false,
      studios:
        anilistAnime.studios?.nodes?.map((studio: any) => studio.name) || [],
      relations:
        anilistAnime.relations?.edges?.map((edge: any) => ({
          type: edge.relationType,
          animeId: `anilist-${edge.node.id}`,
        })) || [],
      confidence,
      lastUpdated: new Date(),
    };
  }

  private calculateConfidence(anime: any): number {
    let confidence = 0.8; // Base confidence for AniList

    // Increase confidence based on data completeness
    if (anime.title.english && anime.title.romaji) confidence += 0.05;
    if (anime.description) confidence += 0.05;
    if (anime.averageScore && anime.averageScore > 0) confidence += 0.05;
    if (anime.episodes && anime.episodes > 0) confidence += 0.03;
    if (anime.genres && anime.genres.length > 0) confidence += 0.02;

    return Math.min(1, confidence);
  }

  private mapStatus(anilistStatus: string): AnimeData["status"] {
    switch (anilistStatus) {
      case "FINISHED":
        return "FINISHED";
      case "RELEASING":
        return "RELEASING";
      case "NOT_YET_RELEASED":
        return "NOT_YET_RELEASED";
      case "CANCELLED":
        return "CANCELLED";
      case "HIATUS":
        return "HIATUS";
      default:
        return "FINISHED";
    }
  }
}
