// Base interface for all data sources
export interface DataSource {
  name: string;
  searchAnime(query: string, options?: SearchOptions): Promise<AnimeData[]>;
  getAnimeDetails(id: string): Promise<AnimeData | null>;
  getRecommendations(animeId: string): Promise<AnimeData[]>;
}

export interface SearchOptions {
  page?: number;
  perPage?: number;
  genres?: string[];
  year?: number;
  status?: string;
  includeAdult?: boolean; // Default: false - exclude 18+ content
}

// Unified anime data structure
export interface AnimeData {
  // Core identifiers
  id: string;
  sourceId: string; // ID from the original source
  source: string; // Which data source this came from

  // Basic info
  title: {
    english?: string;
    romaji?: string;
    native?: string;
    common?: string; // Most commonly used title
  };
  description?: string;

  // Visual
  coverImage?: {
    large?: string;
    medium?: string;
    small?: string;
  };
  bannerImage?: string;

  // Ratings and scores
  averageScore?: number; // 0-100
  popularity?: number;
  userCount?: number; // Number of users who rated

  // Technical details
  episodes?: number;
  duration?: number; // minutes per episode
  status?:
    | "FINISHED"
    | "RELEASING"
    | "NOT_YET_RELEASED"
    | "CANCELLED"
    | "HIATUS";

  // Dates
  startDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  endDate?: {
    year?: number;
    month?: number;
    day?: number;
  };

  // Classification
  genres: string[];
  tags: string[];
  demographics?: string[]; // shounen, seinen, etc.
  themes?: string[]; // school, romance, etc.
  isAdult?: boolean; // 18+ content flag

  // Production
  studios?: string[];
  producers?: string[];

  // Relations
  relations?: {
    type: string; // sequel, prequel, adaptation, etc.
    animeId: string;
  }[];

  // Data quality indicators
  confidence?: number; // 0-1, how confident we are in this data
  lastUpdated?: Date;
}

// Recommendation result with scoring
export interface RecommendationResult {
  anime: AnimeData;
  score: number; // 0-1, similarity score
  reasons: RecommendationReason[];
}

export interface RecommendationReason {
  type:
    | "genre"
    | "studio"
    | "director"
    | "theme"
    | "rating"
    | "year"
    | "demographic";
  value: string;
  weight: number; // How much this contributed to the recommendation
}

// Error handling
export class DataSourceError extends Error {
  constructor(
    message: string,
    public source: string,
    public originalError?: Error
  ) {
    super(`[${source}] ${message}`);
    this.name = "DataSourceError";
  }
}

// Rate limiting interface
export interface RateLimiter {
  canMakeRequest(): boolean;
  recordRequest(): void;
  getWaitTime(): number; // milliseconds to wait
}
