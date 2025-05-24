import type {
  DataSource,
  AnimeData,
  SearchOptions,
  RateLimiter,
} from "./base.js";
import { DataSourceError } from "./base.js";

// Rate limiter for AnimeThemes API
class AnimeThemesRateLimiter implements RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 60; // 60 requests per minute
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

export class AnimeThemesDataSource implements DataSource {
  name = "AnimeThemes";
  private baseUrl = "https://api.animethemes.moe";
  private rateLimiter = new AnimeThemesRateLimiter();

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
      "filter[name]": query,
      page: (options.page || 1).toString(),
      "page[size]": (options.perPage || 20).toString(),
      include: "animethemes.animethemeentries.videos,images",
    });

    const url = `${this.baseUrl}/anime?${params}`;

    try {
      const response = await this.makeRequest<any>(url);
      return (
        response.anime?.map((anime: any) =>
          this.transformToAnimeData(anime, response.included)
        ) || []
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
    const url = `${this.baseUrl}/anime/${id}?include=animethemes.animethemeentries.videos,images,animestudios.studio,animeseries.series`;

    try {
      const response = await this.makeRequest<any>(url);
      return response.anime
        ? this.transformToAnimeData(response.anime, response.included)
        : null;
    } catch (error) {
      throw new DataSourceError(
        `Failed to get details for anime slug ${id}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getRecommendations(animeId: string): Promise<AnimeData[]> {
    // AnimeThemes doesn't have a recommendations endpoint
    // We can try to find related anime by series or studio
    try {
      const animeDetails = await this.getAnimeDetails(animeId);
      if (!animeDetails) return [];

      // Search for anime from the same studios
      const studios = animeDetails.studios || [];
      if (studios.length === 0) return [];

      const studioQuery = studios[0]; // Use first studio
      const params = new URLSearchParams({
        "filter[studio][name]": studioQuery,
        "page[size]": "10",
        include: "animethemes.animethemeentries.videos,images",
      });

      const url = `${this.baseUrl}/anime?${params}`;
      const response = await this.makeRequest<any>(url);

      return (response.anime || [])
        .filter((anime: any) => anime.slug !== animeId)
        .slice(0, 10)
        .map((anime: any) =>
          this.transformToAnimeData(anime, response.included)
        );
    } catch (error) {
      console.warn(`AnimeThemes recommendations failed for ${animeId}:`, error);
      return [];
    }
  }

  private transformToAnimeData(animeTheme: any, included?: any[]): AnimeData {
    const confidence = this.calculateConfidence(animeTheme);

    // Extract images from included data
    const images = this.extractImages(animeTheme, included);

    // Extract studios from included data
    const studios = this.extractStudios(animeTheme, included);

    return {
      id: `animethemes-${animeTheme.slug}`,
      sourceId: animeTheme.slug,
      source: this.name,
      title: {
        english: animeTheme.name,
        common: animeTheme.name,
      },
      description: animeTheme.synopsis,
      coverImage: {
        large: images.large,
        medium: images.medium,
        small: images.small,
      },
      bannerImage: images.large,
      episodes: this.parseEpisodeCount(animeTheme.name),
      status: this.mapStatus(animeTheme.year),
      startDate: animeTheme.year ? { year: animeTheme.year } : undefined,
      genres: [], // AnimeThemes doesn't provide genre data
      tags: [],
      studios: studios,
      confidence,
      lastUpdated: new Date(),
    };
  }

  private calculateConfidence(anime: any): number {
    let confidence = 0.6; // Base confidence for AnimeThemes

    // AnimeThemes is excellent for theme songs but limited for general anime data
    if (anime.name) confidence += 0.1;
    if (anime.synopsis) confidence += 0.05;
    if (anime.year) confidence += 0.05;
    if (anime.season) confidence += 0.03;

    return Math.min(1, confidence);
  }

  private extractImages(
    anime: any,
    included?: any[]
  ): {
    large?: string;
    medium?: string;
    small?: string;
  } {
    if (!included || !anime.relationships?.images?.data) {
      return {};
    }

    const imageIds = anime.relationships.images.data.map((img: any) => img.id);
    const images = included.filter(
      (item) => item.type === "images" && imageIds.includes(item.id)
    );

    if (images.length === 0) return {};

    const image = images[0]; // Use first image
    return {
      large: image.link,
      medium: image.link,
      small: image.link,
    };
  }

  private extractStudios(anime: any, included?: any[]): string[] {
    if (!included || !anime.relationships?.animestudios?.data) {
      return [];
    }

    const studioRelationIds = anime.relationships.animestudios.data.map(
      (rel: any) => rel.id
    );

    const studioRelations = included.filter(
      (item) =>
        item.type === "animestudios" && studioRelationIds.includes(item.id)
    );

    const studioIds = studioRelations
      .map((rel) => rel.relationships?.studio?.data?.id)
      .filter(Boolean);

    const studios = included
      .filter((item) => item.type === "studios" && studioIds.includes(item.id))
      .map((studio) => studio.name);

    return studios;
  }

  private parseEpisodeCount(title: string): number | undefined {
    // Try to extract episode count from title patterns
    const match = title.match(/(\d+)\s*(?:episodes?|eps?)/i);
    return match ? parseInt(match[1]) : undefined;
  }

  private mapStatus(year?: number): AnimeData["status"] {
    if (!year) return "FINISHED";

    const currentYear = new Date().getFullYear();
    if (year > currentYear) return "NOT_YET_RELEASED";
    if (year === currentYear) return "RELEASING";
    return "FINISHED";
  }
}
