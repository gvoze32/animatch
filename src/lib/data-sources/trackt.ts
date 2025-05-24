import type {
  DataSource,
  AnimeData,
  SearchOptions,
  RateLimiter,
} from "./base.js";
import { DataSourceError } from "./base.js";

// Simple rate limiter for TrackT API
class TrackTRateLimiter implements RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 10; // Conservative rate limit
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

// TrackT API interfaces (hypothetical structure)
interface TrackTAnime {
  id: number;
  title: string;
  english_title?: string;
  japanese_title?: string;
  description?: string;
  poster_url?: string;
  cover_url?: string;
  rating?: number;
  popularity?: number;
  episode_count?: number;
  duration?: number;
  status?: string;
  release_date?: string;
  end_date?: string;
  genres?: string[];
  tags?: string[];
  studios?: string[];
  is_adult?: boolean;
}

interface TrackTSearchResponse {
  data: TrackTAnime[];
  pagination?: {
    current_page: number;
    total_pages: number;
    total_results: number;
  };
}

export class TrackTDataSource implements DataSource {
  name = "TrackT";
  private baseUrl = "https://api.trackt.com/v1"; // Hypothetical URL
  private rateLimiter = new TrackTRateLimiter();

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
        // Handle specific error cases
        if (response.status === 503 || response.status === 404) {
          // Service might be unavailable or endpoint doesn't exist
          throw new Error(`Service unavailable (${response.status})`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Graceful fallback for hypothetical service
      if (error instanceof Error && error.message.includes("fetch")) {
        throw new DataSourceError(
          "TrackT service is currently unavailable",
          this.name,
          error
        );
      }

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
      page: (options.page || 1).toString(),
      limit: (options.perPage || 20).toString(),
    });

    // Add filters
    if (options.genres && options.genres.length > 0) {
      params.append("genres", options.genres.join(","));
    }

    if (options.year) {
      params.append("year", options.year.toString());
    }

    if (options.status) {
      params.append("status", options.status.toLowerCase());
    }

    // Adult content filter
    if (!includeAdult) {
      params.append("exclude_adult", "true");
    }

    try {
      const response = await this.makeRequest<TrackTSearchResponse>(
        `/anime/search?${params.toString()}`
      );

      return response.data
        .filter((anime) => {
          // Additional adult content filtering
          if (!includeAdult && anime.is_adult) {
            return false;
          }
          return true;
        })
        .map((anime) => this.transformToAnimeData(anime));
    } catch (error) {
      // For now, return empty array if service is unavailable
      if (
        error instanceof DataSourceError &&
        error.message.includes("unavailable")
      ) {
        console.warn(`TrackT service unavailable for search: ${query}`);
        return [];
      }

      throw new DataSourceError(
        `Search failed for query "${query}"`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getAnimeDetails(id: string): Promise<AnimeData | null> {
    try {
      // Extract TrackT ID from our internal ID format
      const trackTId = id.startsWith("trackt-")
        ? id.replace("trackt-", "")
        : id;

      const response = await this.makeRequest<{ data: TrackTAnime }>(
        `/anime/${trackTId}`
      );

      return this.transformToAnimeData(response.data);
    } catch (error) {
      if (
        error instanceof DataSourceError &&
        error.message.includes("unavailable")
      ) {
        return null;
      }

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
      // Extract TrackT ID from our internal ID format
      const trackTId = animeId.startsWith("trackt-")
        ? animeId.replace("trackt-", "")
        : animeId;

      const response = await this.makeRequest<{ data: TrackTAnime[] }>(
        `/anime/${trackTId}/recommendations`
      );

      return response.data
        .slice(0, 10) // Limit to 10 recommendations
        .map((anime) => this.transformToAnimeData(anime));
    } catch (error) {
      // Return empty array if service is unavailable
      if (
        error instanceof DataSourceError &&
        error.message.includes("unavailable")
      ) {
        return [];
      }

      throw new DataSourceError(
        `Failed to get recommendations for anime ID ${animeId}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  private transformToAnimeData(trackTAnime: TrackTAnime): AnimeData {
    const confidence = this.calculateConfidence(trackTAnime);

    return {
      id: `trackt-${trackTAnime.id}`,
      sourceId: trackTAnime.id.toString(),
      source: this.name,
      title: {
        english: trackTAnime.english_title,
        romaji: trackTAnime.title,
        native: trackTAnime.japanese_title,
        common: trackTAnime.english_title || trackTAnime.title,
      },
      description: trackTAnime.description,
      coverImage: {
        large: trackTAnime.cover_url,
        medium: trackTAnime.poster_url,
        small: trackTAnime.poster_url,
      },
      bannerImage: trackTAnime.cover_url,
      averageScore: trackTAnime.rating ? trackTAnime.rating * 10 : undefined, // Convert to 0-100 scale
      popularity: trackTAnime.popularity,
      episodes: trackTAnime.episode_count,
      duration: trackTAnime.duration,
      status: this.mapStatus(trackTAnime.status),
      startDate: trackTAnime.release_date
        ? this.parseDate(trackTAnime.release_date)
        : undefined,
      endDate: trackTAnime.end_date
        ? this.parseDate(trackTAnime.end_date)
        : undefined,
      genres: trackTAnime.genres || [],
      tags: trackTAnime.tags || [],
      isAdult: trackTAnime.is_adult || false,
      studios: trackTAnime.studios || [],
      confidence,
      lastUpdated: new Date(),
    };
  }

  private parseDate(
    dateString: string
  ): { year?: number; month?: number; day?: number } | undefined {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return undefined;

      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
      };
    } catch {
      return undefined;
    }
  }

  private calculateConfidence(anime: TrackTAnime): number {
    let confidence = 0.7; // Base confidence for TrackT

    // Adjust based on data completeness
    if (anime.english_title || anime.japanese_title) confidence += 0.05;
    if (anime.description) confidence += 0.05;
    if (anime.rating && anime.rating > 0) confidence += 0.05;
    if (anime.episode_count && anime.episode_count > 0) confidence += 0.03;
    if (anime.genres && anime.genres.length > 0) confidence += 0.02;

    return Math.min(1, confidence);
  }

  private mapStatus(trackTStatus?: string): AnimeData["status"] {
    if (!trackTStatus) return "FINISHED";

    switch (trackTStatus.toLowerCase()) {
      case "completed":
      case "finished":
        return "FINISHED";
      case "airing":
      case "ongoing":
        return "RELEASING";
      case "upcoming":
      case "announced":
        return "NOT_YET_RELEASED";
      case "cancelled":
        return "CANCELLED";
      case "hiatus":
        return "HIATUS";
      default:
        return "FINISHED";
    }
  }
}
