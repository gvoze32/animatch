import { DataAggregator } from "./data-sources/aggregator.js";
import {
  RecommendationEngine,
  type UserPreferences,
} from "./recommendation-engine.js";
import { animeCache } from "./cache.js";
import type {
  AnimeData,
  RecommendationResult,
  SearchOptions,
} from "./data-sources/base.js";

export class AniMatchService {
  private aggregator: DataAggregator;
  private recommendationEngine: RecommendationEngine;

  constructor() {
    this.aggregator = new DataAggregator({
      // Enable all sources by default
      sources: {
        anilist: true,
        myanimelist: true,
        kitsu: true,
        animethemes: true,
        consumet: true,
        jikan: true,
        tmdb: true,
        trackt: true,
      },
      // Weight sources based on data quality and reliability
      weights: {
        anilist: 0.35,
        myanimelist: 0.25,
        kitsu: 0.2,
        animethemes: 0.1,
        consumet: 0.1,
        jikan: 0.05,
        tmdb: 0.05,
        trackt: 0.05,
      },
      timeout: 10000,
    });

    this.recommendationEngine = new RecommendationEngine({
      genre: 0.35,
      studio: 0.2,
      score: 0.15,
      tags: 0.15,
      year: 0.08,
      demographic: 0.05,
      episodes: 0.02,
    });
  }

  /**
   * Search for anime across all data sources
   */
  async searchAnime(
    query: string,
    options: SearchOptions = {}
  ): Promise<AnimeData[]> {
    // Check cache first
    const cacheKey = `${query}-${JSON.stringify(options)}`;
    const cached = animeCache.getSearchResults(query, options);
    if (cached) {
      return cached;
    }

    try {
      const results = await this.aggregator.searchAnime(query, options);

      // Cache the results
      animeCache.setSearchResults(query, options, results);

      return results;
    } catch (error) {
      console.error("Search failed:", error);
      throw new Error(
        `Search failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get detailed information for a specific anime
   */
  async getAnimeDetails(id: string): Promise<AnimeData | null> {
    // Check cache first
    const cached = animeCache.getAnimeDetails(id);
    if (cached) {
      return cached;
    }

    try {
      const details = await this.aggregator.getAnimeDetails(id);

      if (details) {
        // Cache the details
        animeCache.setAnimeDetails(id, details);
      }

      return details;
    } catch (error) {
      console.error("Failed to get anime details:", error);
      throw new Error(
        `Failed to get anime details: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get content-based recommendations for a single anime
   */
  async getRecommendations(
    animeId: string,
    userPreferences?: UserPreferences,
    maxResults: number = 20
  ): Promise<RecommendationResult[]> {
    try {
      // Get the source anime details
      const sourceAnime = await this.getAnimeDetails(animeId);
      if (!sourceAnime) {
        throw new Error("Source anime not found");
      }

      // Get raw recommendations from data sources
      const rawRecommendations = await this.aggregator.getRecommendations(
        animeId
      );

      // Use recommendation engine to score and filter
      const recommendations =
        this.recommendationEngine.getContentBasedRecommendations(
          sourceAnime,
          rawRecommendations,
          userPreferences
        );

      return recommendations.slice(0, maxResults);
    } catch (error) {
      console.error("Failed to get recommendations:", error);
      throw new Error(
        `Failed to get recommendations: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get hybrid recommendations based on multiple anime
   */
  async getHybridRecommendations(
    animeIds: string[],
    userPreferences?: UserPreferences,
    maxResults: number = 20
  ): Promise<RecommendationResult[]> {
    if (animeIds.length === 0) {
      throw new Error("At least one anime ID is required");
    }

    try {
      // Get details for all source anime
      const sourceAnimePromises = animeIds.map((id) =>
        this.getAnimeDetails(id)
      );
      const sourceAnimeResults = await Promise.all(sourceAnimePromises);
      const sourceAnime = sourceAnimeResults.filter(
        (anime): anime is AnimeData => anime !== null
      );

      if (sourceAnime.length === 0) {
        throw new Error("No valid source anime found");
      }

      // Get candidate anime by searching for popular anime in the same genres
      const allGenres = Array.from(
        new Set(sourceAnime.flatMap((anime) => anime.genres))
      );
      const candidates = await this.searchAnime("", {
        genres: allGenres.slice(0, 3), // Use top 3 most common genres
        perPage: 50,
      });

      // Use recommendation engine for hybrid recommendations
      const recommendations =
        this.recommendationEngine.getHybridRecommendations(
          sourceAnime,
          candidates,
          userPreferences
        );

      return recommendations.slice(0, maxResults);
    } catch (error) {
      console.error("Failed to get hybrid recommendations:", error);
      throw new Error(
        `Failed to get hybrid recommendations: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get recommendations based purely on user preferences
   */
  async getPreferenceBasedRecommendations(
    userPreferences: UserPreferences,
    maxResults: number = 20
  ): Promise<RecommendationResult[]> {
    try {
      // Search for anime matching user preferences
      const candidates = await this.searchAnime("", {
        genres: userPreferences.favoriteGenres.slice(0, 3),
        perPage: 100,
      });

      // Use recommendation engine to score based on preferences
      const recommendations =
        this.recommendationEngine.getPreferenceBasedRecommendations(
          candidates,
          userPreferences
        );

      return recommendations.slice(0, maxResults);
    } catch (error) {
      console.error("Failed to get preference-based recommendations:", error);
      throw new Error(
        `Failed to get preference-based recommendations: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get trending/popular anime across all sources
   */
  async getTrendingAnime(limit: number = 20): Promise<AnimeData[]> {
    try {
      // Search for highly rated recent anime
      const currentYear = new Date().getFullYear();
      const recentAnime = await this.searchAnime("", {
        year: currentYear,
        perPage: 30,
      });

      // Sort by score and popularity
      const trending = recentAnime
        .filter((anime) => anime.averageScore && anime.averageScore > 70)
        .sort((a, b) => {
          const scoreA = (a.averageScore || 0) * (a.confidence || 0.5);
          const scoreB = (b.averageScore || 0) * (b.confidence || 0.5);
          return scoreB - scoreA;
        });

      return trending.slice(0, limit);
    } catch (error) {
      console.error("Failed to get trending anime:", error);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Get available genres across all sources
   */
  getAvailableGenres(): string[] {
    // Common anime genres across all sources
    return [
      "Action",
      "Adventure",
      "Comedy",
      "Drama",
      "Ecchi",
      "Fantasy",
      "Horror",
      "Mahou Shoujo",
      "Mecha",
      "Music",
      "Mystery",
      "Psychological",
      "Romance",
      "Sci-Fi",
      "Slice of Life",
      "Sports",
      "Supernatural",
      "Thriller",
      "Hentai",
      "Josei",
      "Kids",
      "Historical",
      "Military",
      "Parody",
      "Police",
      "Post-Apocalyptic",
      "Reverse Harem",
      "Samurai",
      "School",
      "Space",
      "Super Power",
      "Vampire",
      "Yaoi",
      "Yuri",
    ].sort();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return animeCache.getStats();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    animeCache.clear();
  }
}
