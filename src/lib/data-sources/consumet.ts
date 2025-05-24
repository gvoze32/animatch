import type {
  DataSource,
  AnimeData,
  SearchOptions,
  RateLimiter,
} from "./base.js";
import { DataSourceError } from "./base.js";

// Rate limiter for Consumet API
class ConsumetRateLimiter implements RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 100; // Conservative limit
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

export class ConsumetDataSource implements DataSource {
  name = "Consumet";
  private baseUrl = "https://api.consumet.org";
  private rateLimiter = new ConsumetRateLimiter();

  private async makeRequest<T>(url: string): Promise<T> {
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    try {
      this.rateLimiter.recordRequest();
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "AniMatch/1.0",
        },
      });

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
      query,
      page: (options.page || 1).toString(),
    });

    const url = `${this.baseUrl}/anime/gogoanime/${encodeURIComponent(query)}`;

    try {
      const response = await this.makeRequest<any>(url);
      const results = response.results || [];

      let animeResults = results
        .slice(0, options.perPage || 20)
        .map((anime: any) => this.transformToAnimeData(anime));

      // Apply adult content filtering (disabled by default)
      if (!options.includeAdult) {
        animeResults = animeResults.filter(
          (anime: AnimeData) => !this.isAdultContent(anime)
        );
      }

      return animeResults;
    } catch (error) {
      throw new DataSourceError(
        `Search failed for query "${query}"`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getAnimeDetails(id: string): Promise<AnimeData | null> {
    const url = `${this.baseUrl}/anime/gogoanime/info/${id}`;

    try {
      const response = await this.makeRequest<any>(url);
      return response ? this.transformToAnimeData(response) : null;
    } catch (error) {
      throw new DataSourceError(
        `Failed to get details for anime ID ${id}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getRecommendations(animeId: string): Promise<AnimeData[]> {
    // Consumet doesn't have a direct recommendations endpoint
    // We can try to get popular anime as fallback
    try {
      const url = `${this.baseUrl}/anime/gogoanime/top-airing`;
      const response = await this.makeRequest<any>(url);
      const results = response.results || [];

      return results
        .slice(0, 10)
        .map((anime: any) => this.transformToAnimeData(anime));
    } catch (error) {
      console.warn(`Consumet recommendations failed for ${animeId}:`, error);
      return [];
    }
  }

  private transformToAnimeData(consumetAnime: any): AnimeData {
    const confidence = this.calculateConfidence(consumetAnime);
    const genres = consumetAnime.genres || [];
    const isAdult = this.determineAdultContent(consumetAnime, genres);

    return {
      id: `consumet-${consumetAnime.id}`,
      sourceId: consumetAnime.id,
      source: this.name,
      title: {
        english: consumetAnime.title,
        common: consumetAnime.title,
      },
      description: consumetAnime.description || consumetAnime.plot,
      coverImage: {
        large: consumetAnime.image,
        medium: consumetAnime.image,
        small: consumetAnime.image,
      },
      bannerImage: consumetAnime.image,
      episodes: consumetAnime.totalEpisodes,
      status: this.mapStatus(consumetAnime.status),
      startDate: this.parseDate(consumetAnime.releaseDate),
      genres: genres,
      tags: consumetAnime.subOrDub ? [consumetAnime.subOrDub] : [],
      isAdult,
      confidence,
      lastUpdated: new Date(),
    };
  }

  private calculateConfidence(anime: any): number {
    let confidence = 0.65; // Base confidence for Consumet

    // Increase confidence based on data completeness
    if (anime.title) confidence += 0.1;
    if (anime.description) confidence += 0.05;
    if (anime.totalEpisodes && anime.totalEpisodes > 0) confidence += 0.05;
    if (anime.genres && anime.genres.length > 0) confidence += 0.05;
    if (anime.releaseDate) confidence += 0.03;
    if (anime.image) confidence += 0.02;

    return Math.min(1, confidence);
  }

  private mapStatus(consumetStatus?: string): AnimeData["status"] {
    if (!consumetStatus) return "FINISHED";

    switch (consumetStatus.toLowerCase()) {
      case "ongoing":
      case "airing":
        return "RELEASING";
      case "completed":
      case "finished":
        return "FINISHED";
      case "upcoming":
      case "not yet aired":
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
    if (isNaN(date.getTime())) {
      // Try to parse just the year
      const yearMatch = dateString.match(/(\d{4})/);
      if (yearMatch) {
        return { year: parseInt(yearMatch[1]) };
      }
      return undefined;
    }

    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }

  private determineAdultContent(consumetAnime: any, genres: string[]): boolean {
    // Check for adult genres
    const adultGenres = ["Hentai", "Ecchi", "Adult", "Mature"];
    const hasAdultGenre = genres.some((genre) =>
      adultGenres.some((adultGenre) =>
        genre.toLowerCase().includes(adultGenre.toLowerCase())
      )
    );

    // Check title for adult content indicators
    const title = (consumetAnime.title || "").toLowerCase();
    const hasAdultTitle = adultGenres.some((adultGenre) =>
      title.includes(adultGenre.toLowerCase())
    );

    return hasAdultGenre || hasAdultTitle;
  }

  private isAdultContent(anime: AnimeData): boolean {
    return anime.isAdult === true;
  }
}
