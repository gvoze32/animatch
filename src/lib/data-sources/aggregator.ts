import type {
  DataSource,
  AnimeData,
  SearchOptions,
  RecommendationResult,
  RecommendationReason,
} from "./base.js";
import { AniListDataSource } from "./anilist.js";
import { MyAnimeListDataSource } from "./myanimelist.js";
import { KitsuDataSource } from "./kitsu.js";
import { AnimeThemesDataSource } from "./animethemes.js";
import { ConsumetDataSource } from "./consumet.js";
import { JikanDataSource } from "./jikan.js";
import { TMDBDataSource } from "./tmdb.js";
import { TrackTDataSource } from "./trackt.js";

export interface AggregatorConfig {
  sources: {
    anilist: boolean;
    myanimelist: boolean;
    kitsu: boolean;
    animethemes: boolean;
    consumet: boolean;
    jikan: boolean;
    tmdb: boolean;
    trackt: boolean;
  };
  weights: {
    anilist: number;
    myanimelist: number;
    kitsu: number;
    animethemes: number;
    consumet: number;
    jikan: number;
    tmdb: number;
    trackt: number;
  };
  timeout: number; // milliseconds
}

export class DataAggregator {
  private sources: Map<string, DataSource> = new Map();
  private config: AggregatorConfig;

  constructor(config: Partial<AggregatorConfig> = {}) {
    this.config = {
      sources: {
        anilist: true,
        myanimelist: true,
        kitsu: true,
        animethemes: true,
        consumet: true,
        jikan: true,
        tmdb: true,
        trackt: true,
        ...config.sources,
      },
      weights: {
        anilist: 0.25,
        myanimelist: 0.2,
        kitsu: 0.15,
        animethemes: 0.1,
        consumet: 0.08,
        jikan: 0.12,
        tmdb: 0.05,
        trackt: 0.05,
        ...config.weights,
      },
      timeout: config.timeout || 10000,
    };

    this.initializeSources();
  }

  private initializeSources(): void {
    if (this.config.sources.anilist) {
      this.sources.set("anilist", new AniListDataSource());
    }
    if (this.config.sources.myanimelist) {
      this.sources.set("myanimelist", new MyAnimeListDataSource());
    }
    if (this.config.sources.kitsu) {
      this.sources.set("kitsu", new KitsuDataSource());
    }
    if (this.config.sources.animethemes) {
      this.sources.set("animethemes", new AnimeThemesDataSource());
    }
    if (this.config.sources.consumet) {
      this.sources.set("consumet", new ConsumetDataSource());
    }
    if (this.config.sources.jikan) {
      this.sources.set("jikan", new JikanDataSource());
    }
    if (this.config.sources.tmdb) {
      this.sources.set("tmdb", new TMDBDataSource());
    }
    if (this.config.sources.trackt) {
      this.sources.set("trackt", new TrackTDataSource());
    }
  }

  async searchAnime(
    query: string,
    options: SearchOptions = {}
  ): Promise<AnimeData[]> {
    const promises = Array.from(this.sources.entries()).map(
      async ([sourceName, source]) => {
        try {
          const results = await Promise.race([
            source.searchAnime(query, options),
            new Promise<AnimeData[]>((_, reject) =>
              setTimeout(
                () => reject(new Error("Timeout")),
                this.config.timeout
              )
            ),
          ]);
          return { sourceName, results, error: null };
        } catch (error) {
          console.warn(`Search failed for ${sourceName}:`, error);
          return { sourceName, results: [], error };
        }
      }
    );

    const responses = await Promise.all(promises);
    return this.mergeSearchResults(responses);
  }

  async getAnimeDetails(id: string): Promise<AnimeData | null> {
    // Extract source and ID from the combined ID
    const [sourceName, sourceId] = id.split("-", 2);
    const source = this.sources.get(sourceName);

    if (!source) {
      throw new Error(`Unknown source: ${sourceName}`);
    }

    return await source.getAnimeDetails(sourceId);
  }

  async getRecommendations(animeId: string): Promise<AnimeData[]> {
    // For recommendations, we'll use all sources and merge results
    const [sourceName, sourceId] = animeId.split("-", 2);

    const promises = Array.from(this.sources.entries()).map(
      async ([sName, source]) => {
        try {
          // If it's the same source, use the original ID
          const idToUse = sName === sourceName ? sourceId : animeId;
          const results = await Promise.race([
            source.getRecommendations(idToUse),
            new Promise<AnimeData[]>((_, reject) =>
              setTimeout(
                () => reject(new Error("Timeout")),
                this.config.timeout
              )
            ),
          ]);
          return { sourceName: sName, results, error: null };
        } catch (error) {
          console.warn(`Recommendations failed for ${sName}:`, error);
          return { sourceName: sName, results: [], error };
        }
      }
    );

    const responses = await Promise.all(promises);
    return this.mergeRecommendationResults(responses);
  }

  private mergeSearchResults(
    responses: Array<{ sourceName: string; results: AnimeData[]; error: any }>
  ): AnimeData[] {
    const animeMap = new Map<string, AnimeData[]>();

    // Group anime by title similarity
    responses.forEach(({ sourceName, results }) => {
      results.forEach((anime) => {
        const key = this.generateAnimeKey(anime);
        if (!animeMap.has(key)) {
          animeMap.set(key, []);
        }
        animeMap.get(key)!.push(anime);
      });
    });

    // Merge duplicates and create consolidated entries
    const mergedResults: AnimeData[] = [];

    animeMap.forEach((animeList) => {
      if (animeList.length === 1) {
        mergedResults.push(animeList[0]);
      } else {
        const merged = this.mergeAnimeData(animeList);
        mergedResults.push(merged);
      }
    });

    // Sort by confidence and relevance
    return mergedResults.sort((a, b) => {
      const confidenceA = a.confidence || 0;
      const confidenceB = b.confidence || 0;
      const scoreA = (a.averageScore || 0) * confidenceA;
      const scoreB = (b.averageScore || 0) * confidenceB;
      return scoreB - scoreA;
    });
  }

  private mergeRecommendationResults(
    responses: Array<{ sourceName: string; results: AnimeData[]; error: any }>
  ): AnimeData[] {
    const allRecommendations: AnimeData[] = [];

    responses.forEach(({ results }) => {
      allRecommendations.push(...results);
    });

    // Remove duplicates by grouping similar anime
    const uniqueMap = new Map<string, AnimeData>();

    allRecommendations.forEach((anime) => {
      const key = this.generateAnimeKey(anime);
      const existing = uniqueMap.get(key);

      if (!existing || (anime.confidence || 0) > (existing.confidence || 0)) {
        uniqueMap.set(key, anime);
      }
    });

    return Array.from(uniqueMap.values()).slice(0, 20); // Limit to top 20
  }

  private generateAnimeKey(anime: AnimeData): string {
    // Create a key based on title similarity and year
    const title = (
      anime.title.english ||
      anime.title.romaji ||
      anime.title.common ||
      ""
    ).toLowerCase();
    const year = anime.startDate?.year || "unknown";
    const episodes = anime.episodes || "unknown";

    // Remove common words and normalize
    const normalizedTitle = title
      .replace(/[^\w\s]/g, "")
      .replace(/\b(the|a|an|wo|ga|no|ni|de|to)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return `${normalizedTitle}-${year}-${episodes}`;
  }

  private mergeAnimeData(animeList: AnimeData[]): AnimeData {
    // Sort by confidence to prioritize more reliable data
    const sorted = animeList.sort(
      (a, b) => (b.confidence || 0) - (a.confidence || 0)
    );
    const primary = sorted[0];

    // Merge data from all sources, prioritizing higher confidence sources
    const merged: AnimeData = {
      ...primary,
      id: primary.id, // Keep the primary ID
      title: {
        english: this.selectBestValue(sorted, (anime) => anime.title.english),
        romaji: this.selectBestValue(sorted, (anime) => anime.title.romaji),
        native: this.selectBestValue(sorted, (anime) => anime.title.native),
        common: this.selectBestValue(sorted, (anime) => anime.title.common),
      },
      description: this.selectBestValue(sorted, (anime) => anime.description),
      averageScore: this.calculateWeightedAverage(sorted),
      genres: this.mergeArrays(sorted.map((anime) => anime.genres)),
      tags: this.mergeArrays(sorted.map((anime) => anime.tags)),
      studios: this.mergeArrays(sorted.map((anime) => anime.studios || [])),
      confidence: this.calculateCombinedConfidence(sorted),
    };

    return merged;
  }

  private selectBestValue<T>(
    animeList: AnimeData[],
    selector: (anime: AnimeData) => T | undefined
  ): T | undefined {
    for (const anime of animeList) {
      const value = selector(anime);
      if (value) return value;
    }
    return undefined;
  }

  private calculateWeightedAverage(animeList: AnimeData[]): number | undefined {
    let totalScore = 0;
    let totalWeight = 0;

    animeList.forEach((anime) => {
      if (anime.averageScore && anime.confidence) {
        const weight =
          this.config.weights[
            anime.source.toLowerCase() as keyof typeof this.config.weights
          ] || 0.1;
        // Calculate weighted score correctly: use confidence * weight as the weight factor
        const weightedFactor = anime.confidence * weight;
        totalScore += anime.averageScore * weightedFactor;
        totalWeight += weightedFactor;
      }
    });
    const result = totalWeight > 0 ? totalScore / totalWeight : undefined;

    return result;
  }

  private mergeArrays(arrays: (string[] | undefined)[]): string[] {
    const merged = new Set<string>();
    arrays.forEach((arr) => {
      if (arr) {
        arr.forEach((item) => merged.add(item));
      }
    });
    return Array.from(merged);
  }

  private calculateCombinedConfidence(animeList: AnimeData[]): number {
    // Higher confidence when multiple sources agree
    const baseConfidence = Math.max(
      ...animeList.map((anime) => anime.confidence || 0)
    );
    const sourceBonus = Math.min(0.2, (animeList.length - 1) * 0.1);
    return Math.min(1, baseConfidence + sourceBonus);
  }
}
