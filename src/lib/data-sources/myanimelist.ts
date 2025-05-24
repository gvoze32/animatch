import type {
  DataSource,
  AnimeData,
  SearchOptions,
  RateLimiter,
} from "./base.js";
import { DataSourceError } from "./base.js";

// Rate limiter for MyAnimeList API
class MALRateLimiter implements RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 3; // MAL has strict rate limits
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

export class MyAnimeListDataSource implements DataSource {
  name = "MyAnimeList";
  private baseUrl = "https://api.myanimelist.net/v2";
  private rateLimiter = new MALRateLimiter();

  // Note: MAL API requires authentication, but we'll use Jikan API as alternative
  private jikanUrl = "https://api.jikan.moe/v4";

  private async makeRequest<T>(url: string): Promise<T> {
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    try {
      this.rateLimiter.recordRequest();
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new DataSourceError(
        `Request failed: ${
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
    const params = new URLSearchParams({
      q: query,
      page: (options.page || 1).toString(),
      limit: (options.perPage || 20).toString(),
      type: "anime",
    });

    if (options.genres && options.genres.length > 0) {
      params.append("genres", options.genres.join(","));
    }

    const url = `${this.jikanUrl}/anime?${params}`;

    try {
      const response = await this.makeRequest<any>(url);
      let results = response.data.map((anime: any) =>
        this.transformToAnimeData(anime)
      );

      // Apply adult content filtering (disabled by default)
      if (!options.includeAdult) {
        results = results.filter(
          (anime: AnimeData) => !this.isAdultContent(anime)
        );
      }

      return results;
    } catch (error) {
      throw new DataSourceError(
        `Search failed for query "${query}"`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getAnimeDetails(id: string): Promise<AnimeData | null> {
    const url = `${this.jikanUrl}/anime/${id}/full`;

    try {
      const response = await this.makeRequest<any>(url);
      return response.data ? this.transformToAnimeData(response.data) : null;
    } catch (error) {
      throw new DataSourceError(
        `Failed to get details for anime ID ${id}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getRecommendations(animeId: string): Promise<AnimeData[]> {
    const url = `${this.jikanUrl}/anime/${animeId}/recommendations`;

    try {
      const response = await this.makeRequest<any>(url);
      return response.data
        .slice(0, 10) // Limit to 10 recommendations
        .map((rec: any) => this.transformToAnimeData(rec.entry));
    } catch (error) {
      throw new DataSourceError(
        `Failed to get recommendations for anime ID ${animeId}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  private transformToAnimeData(malAnime: any): AnimeData {
    const confidence = this.calculateConfidence(malAnime);
    const genres = malAnime.genres?.map((genre: any) => genre.name) || [];
    const isAdult = this.determineAdultContent(malAnime, genres);

    return {
      id: `mal-${malAnime.mal_id}`,
      sourceId: malAnime.mal_id.toString(),
      source: this.name,
      title: {
        english: malAnime.title_english,
        romaji: malAnime.title,
        native: malAnime.title_japanese,
        common: malAnime.title_english || malAnime.title,
      },
      description: malAnime.synopsis,
      coverImage: {
        large: malAnime.images?.jpg?.large_image_url,
        medium: malAnime.images?.jpg?.image_url,
        small: malAnime.images?.jpg?.small_image_url,
      },
      bannerImage: malAnime.images?.jpg?.large_image_url,
      averageScore: malAnime.score ? malAnime.score * 10 : undefined, // Convert to 0-100 scale
      popularity: malAnime.popularity,
      userCount: malAnime.scored_by,
      episodes: malAnime.episodes,
      duration: malAnime.duration
        ? this.parseDuration(malAnime.duration)
        : undefined,
      status: this.mapStatus(malAnime.status),
      startDate: this.parseDate(malAnime.aired?.from),
      endDate: this.parseDate(malAnime.aired?.to),
      genres: genres,
      tags: [
        ...(malAnime.themes?.map((theme: any) => theme.name) || []),
        ...(malAnime.demographics?.map((demo: any) => demo.name) || []),
      ],
      demographics: malAnime.demographics?.map((demo: any) => demo.name) || [],
      themes: malAnime.themes?.map((theme: any) => theme.name) || [],
      studios: malAnime.studios?.map((studio: any) => studio.name) || [],
      producers:
        malAnime.producers?.map((producer: any) => producer.name) || [],
      isAdult,
      confidence,
      lastUpdated: new Date(),
    };
  }

  private calculateConfidence(anime: any): number {
    let confidence = 0.75; // Base confidence for MAL

    // Increase confidence based on data completeness and quality
    if (anime.score && anime.scored_by > 1000) confidence += 0.1;
    if (anime.title_english && anime.title_japanese) confidence += 0.05;
    if (anime.synopsis) confidence += 0.05;
    if (anime.episodes && anime.episodes > 0) confidence += 0.03;
    if (anime.genres && anime.genres.length > 0) confidence += 0.02;

    return Math.min(1, confidence);
  }

  private mapStatus(malStatus: string): AnimeData["status"] {
    switch (malStatus?.toLowerCase()) {
      case "finished airing":
      case "finished":
        return "FINISHED";
      case "currently airing":
      case "airing":
        return "RELEASING";
      case "not yet aired":
      case "not yet released":
        return "NOT_YET_RELEASED";
      default:
        return "FINISHED";
    }
  }

  private parseDate(
    dateString?: string
  ): { year?: number; month?: number; day?: number } | undefined {
    if (!dateString) return undefined;

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return undefined;

    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }

  private parseDuration(durationString: string): number | undefined {
    // Parse strings like "24 min per ep" or "2 hr 5 min"
    const match = durationString.match(/(\d+)\s*min/i);
    return match ? parseInt(match[1]) : undefined;
  }

  private determineAdultContent(malAnime: any, genres: string[]): boolean {
    // Check rating
    const rating = malAnime.rating?.toUpperCase();
    if (rating === "RX" || rating === "R+" || rating === "R18+") {
      return true;
    }

    // Check for adult genres and themes
    const adultGenres = ["Hentai", "Ecchi", "Adult", "Mature"];
    const hasAdultGenre = genres.some((genre) =>
      adultGenres.some((adultGenre) =>
        genre.toLowerCase().includes(adultGenre.toLowerCase())
      )
    );

    // Also check themes and demographics
    const themes = malAnime.themes?.map((theme: any) => theme.name) || [];
    const demographics =
      malAnime.demographics?.map((demo: any) => demo.name) || [];
    const allTags = [...themes, ...demographics];

    const hasAdultTheme = allTags.some((tag) =>
      adultGenres.some((adultGenre) =>
        tag.toLowerCase().includes(adultGenre.toLowerCase())
      )
    );

    return hasAdultGenre || hasAdultTheme;
  }

  private isAdultContent(anime: AnimeData): boolean {
    return anime.isAdult === true;
  }
}
