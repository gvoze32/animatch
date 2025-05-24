import type {
  DataSource,
  AnimeData,
  SearchOptions,
  RateLimiter,
} from "./base.js";
import { DataSourceError } from "./base.js";

// Rate limiter for Kitsu API
class KitsuRateLimiter implements RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 40; // Conservative limit
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

export class KitsuDataSource implements DataSource {
  name = "Kitsu";
  private baseUrl = "https://kitsu.io/api/edge";
  private rateLimiter = new KitsuRateLimiter();

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
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
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
      "filter[text]": query,
      "filter[subtype]": "TV,movie,OVA,ONA,special",
      "page[limit]": (options.perPage || 20).toString(),
      "page[offset]": (
        ((options.page || 1) - 1) *
        (options.perPage || 20)
      ).toString(),
    });

    const url = `${this.baseUrl}/anime?${params}`;

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
    const url = `${this.baseUrl}/anime/${id}?include=genres,categories`;

    try {
      const response = await this.makeRequest<any>(url);
      return response.data
        ? this.transformToAnimeData(response.data, response.included)
        : null;
    } catch (error) {
      throw new DataSourceError(
        `Failed to get details for anime ID ${id}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getRecommendations(animeId: string): Promise<AnimeData[]> {
    // Kitsu doesn't have a direct recommendations endpoint, so we'll get related anime
    const url = `${this.baseUrl}/anime/${animeId}/relationships/media-relationships?include=destination`;

    try {
      const response = await this.makeRequest<any>(url);
      const relatedAnime =
        response.included?.filter((item: any) => item.type === "anime") || [];
      return relatedAnime
        .slice(0, 10)
        .map((anime: any) => this.transformToAnimeData(anime));
    } catch (error) {
      // If relationships fail, return empty array rather than throwing
      console.warn(`Kitsu recommendations failed for ${animeId}:`, error);
      return [];
    }
  }

  private transformToAnimeData(kitsuAnime: any, included?: any[]): AnimeData {
    const attributes = kitsuAnime.attributes;
    const confidence = this.calculateConfidence(attributes);

    // Extract genres from included data if available
    const genres = this.extractGenres(kitsuAnime, included);

    // Determine if content is adult-oriented
    const isAdult = this.determineAdultContent(attributes, genres);

    return {
      id: `kitsu-${kitsuAnime.id}`,
      sourceId: kitsuAnime.id,
      source: this.name,
      title: {
        english: attributes.titles?.en || attributes.titles?.en_us,
        romaji: attributes.titles?.en_jp,
        native: attributes.titles?.ja_jp,
        common: attributes.canonicalTitle,
      },
      description: attributes.synopsis || attributes.description,
      coverImage: {
        large: attributes.posterImage?.large,
        medium: attributes.posterImage?.medium,
        small: attributes.posterImage?.small,
      },
      bannerImage:
        attributes.coverImage?.large || attributes.posterImage?.large,
      averageScore: attributes.averageRating
        ? parseFloat(attributes.averageRating)
        : undefined, // Kitsu already uses 0-100 scale
      popularity: attributes.popularityRank,
      userCount: attributes.userCount,
      episodes: attributes.episodeCount,
      duration: attributes.episodeLength,
      status: this.mapStatus(attributes.status),
      startDate: this.parseDate(attributes.startDate),
      endDate: this.parseDate(attributes.endDate),
      genres: genres,
      tags: [], // Kitsu doesn't have tags in the same way
      demographics: this.extractDemographics(attributes),
      studios: [], // Would need additional API call
      isAdult,
      confidence,
      lastUpdated: new Date(),
    };
  }

  private calculateConfidence(attributes: any): number {
    let confidence = 0.7; // Base confidence for Kitsu

    // Increase confidence based on data completeness
    if (attributes.canonicalTitle) confidence += 0.05;
    if (attributes.synopsis) confidence += 0.05;
    if (attributes.averageRating && attributes.userCount > 100)
      confidence += 0.1;
    if (attributes.episodeCount && attributes.episodeCount > 0)
      confidence += 0.03;
    if (attributes.startDate) confidence += 0.02;

    return Math.min(1, confidence);
  }

  private extractGenres(anime: any, included?: any[]): string[] {
    if (!included) return [];

    const relationships = anime.relationships;
    if (!relationships?.genres?.data) return [];

    const genreIds = relationships.genres.data.map((genre: any) => genre.id);
    const genres = included
      .filter((item) => item.type === "genres" && genreIds.includes(item.id))
      .map((genre) => genre.attributes.name);

    return genres;
  }

  private extractDemographics(attributes: any): string[] {
    const demographics = [];
    if (attributes.ageRating) {
      demographics.push(attributes.ageRating);
    }
    return demographics;
  }

  private mapStatus(kitsuStatus: string): AnimeData["status"] {
    switch (kitsuStatus?.toLowerCase()) {
      case "finished":
        return "FINISHED";
      case "current":
        return "RELEASING";
      case "upcoming":
        return "NOT_YET_RELEASED";
      case "tba":
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

  private determineAdultContent(attributes: any, genres: string[]): boolean {
    // Check age rating
    const ageRating = attributes.ageRating?.toUpperCase();
    if (ageRating === "R18+" || ageRating === "RX" || ageRating === "R+") {
      return true;
    }

    // Check for adult genres
    const adultGenres = ["Hentai", "Ecchi", "Adult", "Mature"];
    const hasAdultGenre = genres.some((genre) =>
      adultGenres.some((adultGenre) =>
        genre.toLowerCase().includes(adultGenre.toLowerCase())
      )
    );

    return hasAdultGenre;
  }

  private isAdultContent(anime: AnimeData): boolean {
    return anime.isAdult === true;
  }
}
