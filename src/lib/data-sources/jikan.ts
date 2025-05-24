import type {
  DataSource,
  AnimeData,
  SearchOptions,
  RateLimiter,
} from "./base.js";
import { DataSourceError } from "./base.js";

// Rate limiter for Jikan API (unofficial MyAnimeList API)
class JikanRateLimiter implements RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 3; // Conservative: 3 requests per second
  private readonly windowMs = 1000; // 1 second

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

interface JikanAnime {
  mal_id: number;
  url: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
    webp: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  trailer?: {
    youtube_id?: string;
    url?: string;
    embed_url?: string;
  };
  approved: boolean;
  titles: Array<{
    type: string;
    title: string;
  }>;
  title: string;
  title_english?: string;
  title_japanese?: string;
  title_synonyms: string[];
  type: string;
  source: string;
  episodes?: number;
  status: string;
  airing: boolean;
  aired: {
    from?: string;
    to?: string;
    prop: {
      from?: {
        day?: number;
        month?: number;
        year?: number;
      };
      to?: {
        day?: number;
        month?: number;
        year?: number;
      };
    };
  };
  duration?: string;
  rating?: string;
  score?: number;
  scored_by?: number;
  rank?: number;
  popularity?: number;
  members?: number;
  favorites?: number;
  synopsis?: string;
  background?: string;
  season?: string;
  year?: number;
  broadcast?: {
    day?: string;
    time?: string;
    timezone?: string;
    string?: string;
  };
  producers: Array<{
    mal_id: number;
    type: string;
    name: string;
    url: string;
  }>;
  licensors: Array<{
    mal_id: number;
    type: string;
    name: string;
    url: string;
  }>;
  studios: Array<{
    mal_id: number;
    type: string;
    name: string;
    url: string;
  }>;
  genres: Array<{
    mal_id: number;
    type: string;
    name: string;
    url: string;
  }>;
  explicit_genres: Array<{
    mal_id: number;
    type: string;
    name: string;
    url: string;
  }>;
  themes: Array<{
    mal_id: number;
    type: string;
    name: string;
    url: string;
  }>;
  demographics: Array<{
    mal_id: number;
    type: string;
    name: string;
    url: string;
  }>;
}

interface JikanSearchResponse {
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: {
      count: number;
      total: number;
      per_page: number;
    };
  };
  data: JikanAnime[];
}

export class JikanDataSource implements DataSource {
  name = "Jikan";
  private baseUrl = "https://api.jikan.moe/v4";
  private rateLimiter = new JikanRateLimiter();

  private async makeRequest<T>(endpoint: string): Promise<T> {
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    try {
      this.rateLimiter.recordRequest();
      const response = await fetch(`${this.baseUrl}${endpoint}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new DataSourceError(
        `API request failed: ${
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

    const params = new URLSearchParams({
      q: query,
      type: "anime",
      page: (options.page || 1).toString(),
      limit: (options.perPage || 20).toString(),
    });

    // Add genre filter if specified
    if (options.genres && options.genres.length > 0) {
      // Note: Jikan uses genre IDs, but for simplicity we'll search by name
      // In a real implementation, you'd want to map genre names to IDs
      params.append("genres", options.genres.join(","));
    }

    // Add year filter if specified
    if (options.year) {
      params.append("start_date", `${options.year}-01-01`);
      params.append("end_date", `${options.year}-12-31`);
    }

    // Add status filter if specified
    if (options.status) {
      params.append("status", this.mapStatusToJikan(options.status));
    }

    // Rating filter for adult content
    if (!includeAdult) {
      // Exclude R+ and Rx ratings (adult content)
      params.append("rating", "g,pg,pg13,r");
    }

    try {
      const response = await this.makeRequest<JikanSearchResponse>(
        `/anime?${params.toString()}`
      );

      return response.data
        .filter((anime) => {
          // Additional adult content filtering based on genres and rating
          if (!includeAdult) {
            const hasAdultGenre =
              anime.explicit_genres?.some((genre) =>
                genre.name.toLowerCase().includes("hentai")
              ) || anime.rating?.includes("Rx");

            if (hasAdultGenre) return false;
          }
          return true;
        })
        .map((anime) => this.transformToAnimeData(anime));
    } catch (error) {
      throw new DataSourceError(
        `Search failed for query "${query}"`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getAnimeDetails(id: string): Promise<AnimeData | null> {
    try {
      // Extract MAL ID from our internal ID format
      const malId = id.startsWith("jikan-") ? id.replace("jikan-", "") : id;

      const response = await this.makeRequest<{ data: JikanAnime }>(
        `/anime/${malId}/full`
      );

      return this.transformToAnimeData(response.data);
    } catch (error) {
      if (error instanceof DataSourceError && error.message.includes("404")) {
        return null;
      }
      throw new DataSourceError(
        `Failed to get anime details for ID ${id}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getRecommendations(animeId: string): Promise<AnimeData[]> {
    try {
      // Extract MAL ID from our internal ID format
      const malId = animeId.startsWith("jikan-")
        ? animeId.replace("jikan-", "")
        : animeId;

      const response = await this.makeRequest<{
        data: Array<{ entry: JikanAnime }>;
      }>(`/anime/${malId}/recommendations`);

      return response.data
        .slice(0, 10) // Limit to 10 recommendations
        .map((rec) => this.transformToAnimeData(rec.entry));
    } catch (error) {
      throw new DataSourceError(
        `Failed to get recommendations for anime ID ${animeId}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  private transformToAnimeData(jikanAnime: JikanAnime): AnimeData {
    const confidence = this.calculateConfidence(jikanAnime);

    // Determine if content is adult-rated
    const isAdult = this.isAdultContent(jikanAnime);

    // Extract duration in minutes
    const duration = this.parseDuration(jikanAnime.duration);

    return {
      id: `jikan-${jikanAnime.mal_id}`,
      sourceId: jikanAnime.mal_id.toString(),
      source: this.name,
      title: {
        english: jikanAnime.title_english,
        romaji: jikanAnime.title,
        native: jikanAnime.title_japanese,
        common: jikanAnime.title_english || jikanAnime.title,
      },
      description: jikanAnime.synopsis,
      coverImage: {
        large: jikanAnime.images.jpg.large_image_url,
        medium: jikanAnime.images.jpg.image_url,
        small: jikanAnime.images.jpg.small_image_url,
      },
      bannerImage: jikanAnime.images.jpg.large_image_url, // Jikan doesn't have separate banner images
      averageScore: jikanAnime.score ? jikanAnime.score * 10 : undefined, // Convert to 0-100 scale
      popularity: jikanAnime.popularity,
      userCount: jikanAnime.scored_by,
      episodes: jikanAnime.episodes,
      duration,
      status: this.mapStatus(jikanAnime.status),
      startDate: jikanAnime.aired.prop.from
        ? {
            year: jikanAnime.aired.prop.from.year,
            month: jikanAnime.aired.prop.from.month,
            day: jikanAnime.aired.prop.from.day,
          }
        : undefined,
      endDate: jikanAnime.aired.prop.to
        ? {
            year: jikanAnime.aired.prop.to.year,
            month: jikanAnime.aired.prop.to.month,
            day: jikanAnime.aired.prop.to.day,
          }
        : undefined,
      genres: jikanAnime.genres?.map((genre) => genre.name) || [],
      tags: [
        ...(jikanAnime.themes?.map((theme) => theme.name) || []),
        ...(jikanAnime.demographics?.map((demo) => demo.name) || []),
      ],
      demographics: jikanAnime.demographics?.map((demo) => demo.name) || [],
      themes: jikanAnime.themes?.map((theme) => theme.name) || [],
      isAdult,
      studios: jikanAnime.studios?.map((studio) => studio.name) || [],
      producers: jikanAnime.producers?.map((producer) => producer.name) || [],
      confidence,
      lastUpdated: new Date(),
    };
  }

  private isAdultContent(anime: JikanAnime): boolean {
    // Check rating
    if (anime.rating?.includes("Rx") || anime.rating?.includes("R+")) {
      return true;
    }

    // Check explicit genres
    if (
      anime.explicit_genres?.some((genre) =>
        genre.name.toLowerCase().includes("hentai")
      )
    ) {
      return true;
    }

    // Check regular genres for adult content indicators
    const adultGenres = ["Hentai", "Erotica"];
    if (anime.genres?.some((genre) => adultGenres.includes(genre.name))) {
      return true;
    }

    return false;
  }

  private parseDuration(duration?: string): number | undefined {
    if (!duration) return undefined;

    // Parse various duration formats like "24 min", "1 hr 30 min", etc.
    const match = duration.match(/(\d+)\s*(?:hr|hour)?.*?(\d+)?\s*min/i);
    if (match) {
      const hours = parseInt(match[1]) || 0;
      const minutes = parseInt(match[2]) || 0;
      return hours * 60 + minutes;
    }

    // Try to parse simple minute format
    const minuteMatch = duration.match(/(\d+)\s*min/i);
    if (minuteMatch) {
      return parseInt(minuteMatch[1]);
    }

    return undefined;
  }

  private calculateConfidence(anime: JikanAnime): number {
    let confidence = 0.95; // High confidence for Jikan (official MAL data)

    // Adjust based on data completeness
    if (!anime.title_english && !anime.title_japanese) confidence -= 0.05;
    if (!anime.synopsis) confidence -= 0.05;
    if (!anime.score || anime.score === 0) confidence -= 0.03;
    if (!anime.episodes) confidence -= 0.02;

    return Math.min(1, Math.max(0, confidence));
  }

  private mapStatus(jikanStatus: string): AnimeData["status"] {
    switch (jikanStatus.toLowerCase()) {
      case "finished airing":
        return "FINISHED";
      case "currently airing":
        return "RELEASING";
      case "not yet aired":
        return "NOT_YET_RELEASED";
      default:
        return "FINISHED";
    }
  }

  private mapStatusToJikan(status: string): string {
    switch (status.toUpperCase()) {
      case "FINISHED":
        return "complete";
      case "RELEASING":
        return "airing";
      case "NOT_YET_RELEASED":
        return "upcoming";
      default:
        return "complete";
    }
  }
}
