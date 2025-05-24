import type {
  DataSource,
  AnimeData,
  SearchOptions,
  RateLimiter,
} from "./base.js";
import { DataSourceError } from "./base.js";

// Rate limiter for TMDB API
class TMDBRateLimiter implements RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 40; // TMDB allows 40 requests per 10 seconds
  private readonly windowMs = 10000; // 10 seconds

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

interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date: string;
  vote_average: number;
  popularity: number;
  vote_count: number;
  genre_ids: number[];
  original_language: string;
  video: boolean;
  adult: boolean;
}

interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

interface TMDBGenre {
  id: number;
  name: string;
}

interface TMDBGenresResponse {
  genres: TMDBGenre[];
}

export class TMDBDataSource implements DataSource {
  name = "TMDB";
  private apiKey: string;
  private baseUrl = "https://api.themoviedb.org/3";
  private imageBaseUrl = "https://image.tmdb.org/t/p";
  private rateLimiter = new TMDBRateLimiter();
  private genreCache = new Map<number, string>();

  constructor(apiKey: string = import.meta.env.VITE_TMDB_API_KEY || "") {
    if (!apiKey) {
      console.warn(
        "[TMDB] No API key provided. TMDB data source will be disabled."
      );
    }
    this.apiKey = apiKey;
  }

  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    if (!this.apiKey) {
      throw new DataSourceError("TMDB API key not configured", this.name);
    }

    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set("api_key", this.apiKey);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    try {
      this.rateLimiter.recordRequest();
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new DataSourceError(
        `TMDB request failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async loadGenres(): Promise<void> {
    if (this.genreCache.size > 0) return;

    try {
      const response = await this.makeRequest<TMDBGenresResponse>(
        "/genre/movie/list"
      );
      response.genres.forEach((genre) => {
        this.genreCache.set(genre.id, genre.name);
      });
    } catch (error) {
      console.warn("[TMDB] Failed to load genres:", error);
    }
  }

  private transformMovieToAnime(
    movie: TMDBMovie,
    includeAdult: boolean = false
  ): AnimeData {
    // Filter for anime-related movies by checking title/original_title for anime keywords
    const animeKeywords = ["anime", "アニメ", "劇場版", "movie", "film"];
    const isLikelyAnime =
      animeKeywords.some(
        (keyword) =>
          movie.title.toLowerCase().includes(keyword) ||
          movie.original_title.toLowerCase().includes(keyword)
      ) || movie.original_language === "ja"; // Japanese language

    const genres = movie.genre_ids
      .map((id) => this.genreCache.get(id))
      .filter((name): name is string => !!name);

    // Add 18+ tag if adult content
    const tags = isLikelyAnime ? ["movie", "film"] : [];
    if (movie.adult) {
      tags.push("18+", "adult");
    }

    return {
      id: `tmdb-${movie.id}`,
      sourceId: movie.id.toString(),
      source: this.name,
      title: {
        english: movie.title,
        romaji:
          movie.original_title !== movie.title
            ? movie.original_title
            : undefined,
        common: movie.title,
      },
      description: movie.overview || undefined,
      coverImage: movie.poster_path
        ? {
            large: `${this.imageBaseUrl}/w500${movie.poster_path}`,
            medium: `${this.imageBaseUrl}/w342${movie.poster_path}`,
            small: `${this.imageBaseUrl}/w185${movie.poster_path}`,
          }
        : undefined,
      bannerImage: movie.backdrop_path
        ? `${this.imageBaseUrl}/w1280${movie.backdrop_path}`
        : undefined,
      averageScore: Math.round(movie.vote_average * 10), // Convert 0-10 to 0-100
      popularity: movie.popularity,
      userCount: movie.vote_count,
      episodes: 1, // Movies are single episodes
      status: "FINISHED",
      startDate: movie.release_date
        ? {
            year: new Date(movie.release_date).getFullYear(),
            month: new Date(movie.release_date).getMonth() + 1,
            day: new Date(movie.release_date).getDate(),
          }
        : undefined,
      genres,
      tags,
      isAdult: movie.adult,
      confidence: isLikelyAnime ? 0.8 : 0.3, // Lower confidence for non-anime movies
      lastUpdated: new Date(),
    };
  }

  async searchAnime(
    query: string,
    options: SearchOptions = {}
  ): Promise<AnimeData[]> {
    if (!this.apiKey) return [];

    await this.loadGenres();

    try {
      // Search for anime-related movies
      const animeQuery = `${query} anime`;
      const response = await this.makeRequest<TMDBSearchResponse>(
        "/search/movie",
        {
          query: animeQuery,
          page: options.page || 1,
          year: options.year,
          include_adult: options.includeAdult || false,
        }
      );

      const results = response.results
        .map((movie) => this.transformMovieToAnime(movie, options.includeAdult))
        .filter((anime) => {
          // Filter out adult content if not explicitly requested
          if (!options.includeAdult && anime.isAdult) {
            return false;
          }
          return anime.confidence && anime.confidence > 0.5; // Only include likely anime
        })
        .slice(0, options.perPage || 20);

      return results;
    } catch (error) {
      console.warn("[TMDB] Search failed:", error);
      return [];
    }
  }

  async getAnimeDetails(id: string): Promise<AnimeData | null> {
    if (!this.apiKey) return null;

    const tmdbId = id.replace("tmdb-", "");
    await this.loadGenres();

    try {
      const movie = await this.makeRequest<TMDBMovie>(`/movie/${tmdbId}`);
      return this.transformMovieToAnime(movie);
    } catch (error) {
      console.warn(`[TMDB] Failed to get details for ${id}:`, error);
      return null;
    }
  }

  async getRecommendations(animeId: string): Promise<AnimeData[]> {
    if (!this.apiKey) return [];

    const tmdbId = animeId.replace("tmdb-", "");
    await this.loadGenres();

    try {
      const response = await this.makeRequest<TMDBSearchResponse>(
        `/movie/${tmdbId}/recommendations`
      );

      return response.results
        .map((movie) => this.transformMovieToAnime(movie))
        .filter((anime) => anime.confidence && anime.confidence > 0.5)
        .slice(0, 10);
    } catch (error) {
      console.warn(
        `[TMDB] Failed to get recommendations for ${animeId}:`,
        error
      );
      return [];
    }
  }
}
