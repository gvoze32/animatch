import type {
  AnimeData,
  RecommendationResult,
  RecommendationReason,
} from "./data-sources/base.js";

export interface UserPreferences {
  favoriteGenres: string[];
  dislikedGenres: string[];
  preferredDemographics: string[];
  minScore: number;
  maxEpisodes?: number;
  preferredStudios: string[];
  preferredYearRange: {
    min?: number;
    max?: number;
  };
}

export interface SimilarityWeights {
  genre: number;
  studio: number;
  score: number;
  year: number;
  episodes: number;
  demographic: number;
  tags: number;
}

export class RecommendationEngine {
  private defaultWeights: SimilarityWeights = {
    genre: 0.3,
    studio: 0.15,
    score: 0.2,
    year: 0.1,
    episodes: 0.05,
    demographic: 0.1,
    tags: 0.1,
  };

  constructor(private weights: Partial<SimilarityWeights> = {}) {
    this.weights = { ...this.defaultWeights, ...weights };
  }

  /**
   * Get content-based recommendations for an anime
   */
  getContentBasedRecommendations(
    sourceAnime: AnimeData,
    candidateAnime: AnimeData[],
    userPreferences?: UserPreferences
  ): RecommendationResult[] {
    const recommendations: RecommendationResult[] = [];

    candidateAnime.forEach((candidate) => {
      // Skip if it's the same anime
      if (candidate.id === sourceAnime.id) return;

      // Apply user preference filters
      if (
        userPreferences &&
        !this.passesUserFilters(candidate, userPreferences)
      ) {
        return;
      }

      const similarity = this.calculateSimilarity(sourceAnime, candidate);
      const reasons = this.generateReasons(sourceAnime, candidate);

      recommendations.push({
        anime: candidate,
        score: similarity.totalScore,
        reasons,
      });
    });

    // Sort by score and return top recommendations
    return recommendations.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  /**
   * Get hybrid recommendations combining multiple anime preferences
   */
  getHybridRecommendations(
    sourceAnimeList: AnimeData[],
    candidateAnime: AnimeData[],
    userPreferences?: UserPreferences
  ): RecommendationResult[] {
    if (sourceAnimeList.length === 0) return [];

    const recommendations: RecommendationResult[] = [];

    candidateAnime.forEach((candidate) => {
      // Skip if it's already in the source list
      if (sourceAnimeList.some((source) => source.id === candidate.id)) return;

      // Apply user preference filters
      if (
        userPreferences &&
        !this.passesUserFilters(candidate, userPreferences)
      ) {
        return;
      }

      // Calculate average similarity across all source anime
      const similarities = sourceAnimeList.map((source) =>
        this.calculateSimilarity(source, candidate)
      );

      const avgScore =
        similarities.reduce((sum, sim) => sum + sim.totalScore, 0) /
        similarities.length;

      // Combine reasons from all comparisons
      const allReasons = similarities.flatMap((sim) =>
        this.generateReasons(
          sourceAnimeList[similarities.indexOf(sim)],
          candidate
        )
      );

      const uniqueReasons = this.consolidateReasons(allReasons);

      recommendations.push({
        anime: candidate,
        score: avgScore,
        reasons: uniqueReasons,
      });
    });

    return recommendations.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  /**
   * Get recommendations based on user preferences only
   */
  getPreferenceBasedRecommendations(
    candidateAnime: AnimeData[],
    userPreferences: UserPreferences
  ): RecommendationResult[] {
    const recommendations: RecommendationResult[] = [];

    candidateAnime.forEach((candidate) => {
      if (!this.passesUserFilters(candidate, userPreferences)) return;

      const score = this.calculatePreferenceScore(candidate, userPreferences);
      const reasons = this.generatePreferenceReasons(
        candidate,
        userPreferences
      );

      recommendations.push({
        anime: candidate,
        score,
        reasons,
      });
    });

    return recommendations.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  private calculateSimilarity(
    anime1: AnimeData,
    anime2: AnimeData
  ): {
    totalScore: number;
    breakdown: Record<keyof SimilarityWeights, number>;
  } {
    const breakdown: Record<keyof SimilarityWeights, number> = {
      genre: this.calculateGenreSimilarity(anime1.genres, anime2.genres),
      studio: this.calculateStudioSimilarity(
        anime1.studios || [],
        anime2.studios || []
      ),
      score: this.calculateScoreSimilarity(
        anime1.averageScore,
        anime2.averageScore
      ),
      year: this.calculateYearSimilarity(
        anime1.startDate?.year,
        anime2.startDate?.year
      ),
      episodes: this.calculateEpisodeSimilarity(
        anime1.episodes,
        anime2.episodes
      ),
      demographic: this.calculateDemographicSimilarity(
        anime1.demographics || [],
        anime2.demographics || []
      ),
      tags: this.calculateTagSimilarity(anime1.tags, anime2.tags),
    };

    const totalScore = Object.keys(breakdown).reduce((sum, key) => {
      const k = key as keyof SimilarityWeights;
      return sum + breakdown[k] * this.weights[k]!;
    }, 0);

    return { totalScore, breakdown };
  }

  private calculateGenreSimilarity(
    genres1: string[],
    genres2: string[]
  ): number {
    if (genres1.length === 0 || genres2.length === 0) return 0;

    const set1 = new Set(genres1.map((g) => g.toLowerCase()));
    const set2 = new Set(genres2.map((g) => g.toLowerCase()));

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size; // Jaccard similarity
  }

  private calculateStudioSimilarity(
    studios1: string[],
    studios2: string[]
  ): number {
    if (studios1.length === 0 || studios2.length === 0) return 0;

    const set1 = new Set(studios1.map((s) => s.toLowerCase()));
    const set2 = new Set(studios2.map((s) => s.toLowerCase()));

    return set1.size > 0 &&
      set2.size > 0 &&
      [...set1].some((studio) => set2.has(studio))
      ? 1
      : 0;
  }

  private calculateScoreSimilarity(score1?: number, score2?: number): number {
    if (!score1 || !score2) return 0;

    const difference = Math.abs(score1 - score2);
    return Math.max(0, 1 - difference / 100); // Assuming 0-100 scale
  }

  private calculateYearSimilarity(year1?: number, year2?: number): number {
    if (!year1 || !year2) return 0;

    const difference = Math.abs(year1 - year2);
    return Math.max(0, 1 - difference / 10); // 10-year window
  }

  private calculateEpisodeSimilarity(
    episodes1?: number,
    episodes2?: number
  ): number {
    if (!episodes1 || !episodes2) return 0;

    const ratio =
      Math.min(episodes1, episodes2) / Math.max(episodes1, episodes2);
    return ratio;
  }

  private calculateDemographicSimilarity(
    demo1: string[],
    demo2: string[]
  ): number {
    if (demo1.length === 0 || demo2.length === 0) return 0;

    const set1 = new Set(demo1.map((d) => d.toLowerCase()));
    const set2 = new Set(demo2.map((d) => d.toLowerCase()));

    return [...set1].some((demo) => set2.has(demo)) ? 1 : 0;
  }

  private calculateTagSimilarity(tags1: string[], tags2: string[]): number {
    if (tags1.length === 0 || tags2.length === 0) return 0;

    const set1 = new Set(tags1.map((t) => t.toLowerCase()));
    const set2 = new Set(tags2.map((t) => t.toLowerCase()));

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private passesUserFilters(
    anime: AnimeData,
    preferences: UserPreferences
  ): boolean {
    // Check minimum score
    if (anime.averageScore && anime.averageScore < preferences.minScore) {
      return false;
    }

    // Check maximum episodes
    if (
      preferences.maxEpisodes &&
      anime.episodes &&
      anime.episodes > preferences.maxEpisodes
    ) {
      return false;
    }

    // Check year range
    if (anime.startDate?.year) {
      if (
        preferences.preferredYearRange.min &&
        anime.startDate.year < preferences.preferredYearRange.min
      ) {
        return false;
      }
      if (
        preferences.preferredYearRange.max &&
        anime.startDate.year > preferences.preferredYearRange.max
      ) {
        return false;
      }
    }

    // Check for disliked genres
    const animeGenres = anime.genres.map((g) => g.toLowerCase());
    const dislikedGenres = preferences.dislikedGenres.map((g) =>
      g.toLowerCase()
    );
    if (animeGenres.some((genre) => dislikedGenres.includes(genre))) {
      return false;
    }

    return true;
  }

  private calculatePreferenceScore(
    anime: AnimeData,
    preferences: UserPreferences
  ): number {
    let score = 0;

    // Favorite genres bonus
    const animeGenres = anime.genres.map((g) => g.toLowerCase());
    const favoriteGenres = preferences.favoriteGenres.map((g) =>
      g.toLowerCase()
    );
    const genreMatches = animeGenres.filter((genre) =>
      favoriteGenres.includes(genre)
    ).length;
    score += (genreMatches / Math.max(favoriteGenres.length, 1)) * 0.4;

    // Preferred studios bonus
    const animeStudios = (anime.studios || []).map((s) => s.toLowerCase());
    const preferredStudios = preferences.preferredStudios.map((s) =>
      s.toLowerCase()
    );
    if (animeStudios.some((studio) => preferredStudios.includes(studio))) {
      score += 0.2;
    }

    // Demographics bonus
    const animeDemographics = (anime.demographics || []).map((d) =>
      d.toLowerCase()
    );
    const preferredDemographics = preferences.preferredDemographics.map((d) =>
      d.toLowerCase()
    );
    if (
      animeDemographics.some((demo) => preferredDemographics.includes(demo))
    ) {
      score += 0.15;
    }

    // Score bonus (normalized)
    if (anime.averageScore) {
      score += (anime.averageScore / 100) * 0.25;
    }

    return score;
  }

  private generateReasons(
    anime1: AnimeData,
    anime2: AnimeData
  ): RecommendationReason[] {
    const reasons: RecommendationReason[] = [];

    // Genre similarities
    const commonGenres = anime1.genres.filter((g1) =>
      anime2.genres.some((g2) => g1.toLowerCase() === g2.toLowerCase())
    );
    commonGenres.forEach((genre) => {
      reasons.push({
        type: "genre",
        value: genre,
        weight: this.weights.genre! * (1 / commonGenres.length),
      });
    });

    // Studio similarities
    const commonStudios = (anime1.studios || []).filter((s1) =>
      (anime2.studios || []).some((s2) => s1.toLowerCase() === s2.toLowerCase())
    );
    commonStudios.forEach((studio) => {
      reasons.push({
        type: "studio",
        value: studio,
        weight: this.weights.studio!,
      });
    });

    // Year proximity
    if (anime1.startDate?.year && anime2.startDate?.year) {
      const yearDiff = Math.abs(anime1.startDate.year - anime2.startDate.year);
      if (yearDiff <= 3) {
        reasons.push({
          type: "year",
          value: `Both from around ${anime2.startDate.year}`,
          weight: this.weights.year! * (1 - yearDiff / 10),
        });
      }
    }

    return reasons.sort((a, b) => b.weight - a.weight);
  }

  private generatePreferenceReasons(
    anime: AnimeData,
    preferences: UserPreferences
  ): RecommendationReason[] {
    const reasons: RecommendationReason[] = [];

    // Favorite genres
    const animeGenres = anime.genres.map((g) => g.toLowerCase());
    const favoriteGenres = preferences.favoriteGenres.map((g) =>
      g.toLowerCase()
    );
    animeGenres
      .filter((genre) => favoriteGenres.includes(genre))
      .forEach((genre) => {
        reasons.push({
          type: "genre",
          value: genre,
          weight: 0.4 / favoriteGenres.length,
        });
      });

    return reasons;
  }

  private consolidateReasons(
    reasons: RecommendationReason[]
  ): RecommendationReason[] {
    const consolidated = new Map<string, RecommendationReason>();

    reasons.forEach((reason) => {
      const key = `${reason.type}-${reason.value}`;
      const existing = consolidated.get(key);

      if (existing) {
        existing.weight = Math.max(existing.weight, reason.weight);
      } else {
        consolidated.set(key, { ...reason });
      }
    });

    return Array.from(consolidated.values())
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5); // Top 5 reasons
  }
}
