export type SourceName = "anilist" | "mal" | "kitsu";

export const SOURCE_LABELS: Record<SourceName, string> = {
  anilist: "AniList",
  mal: "MyAnimeList",
  kitsu: "Kitsu",
};

/** IDs of the same title on every source we know it from. */
export type ExternalIds = Partial<Record<SourceName, number>>;

export type AnimeStatus =
  | "FINISHED"
  | "RELEASING"
  | "NOT_YET_RELEASED"
  | "CANCELLED"
  | "HIATUS";

export interface Tag {
  name: string;
  /** 0-100 relevance of the tag to the anime (AniList rank); 100 when unknown. */
  rank: number;
  /** Broad cast descriptors ("Male Protagonist", "Ensemble Cast") that say little about similarity. */
  generic?: boolean;
}

export interface Anime {
  /** Stable reference, `<source>-<id>` (see `toRef` / `parseRef`). */
  id: string;
  ids: ExternalIds;
  title: {
    english?: string;
    romaji?: string;
    native?: string;
  };
  description?: string;
  coverImage?: string;
  /** Dominant cover colour (hex), when the source provides one. */
  accentColor?: string;
  bannerImage?: string;
  /** 0-100 */
  averageScore?: number;
  popularity?: number;
  episodes?: number;
  format?: string;
  status?: AnimeStatus;
  year?: number;
  genres: string[];
  tags: Tag[];
  studios: string[];
  isAdult: boolean;
  /** AniList ids of entries in the same franchise (sequels, prequels, side stories…). */
  franchiseIds?: number[];
}

export interface SearchOptions {
  limit?: number;
  includeAdult?: boolean;
}

export type ReasonType = "community" | "genre" | "tag" | "studio";

export interface RecommendationReason {
  type: ReasonType;
  label: string;
}

export interface Recommendation {
  anime: Anime;
  /**
   * Absolute 0-1 match: content similarity blended with saturating community
   * endorsement, so it doesn't depend on which other candidates are present.
   */
  score: number;
  reasons: RecommendationReason[];
  /** Other entries of the same franchise that were collapsed into this one. */
  related: Anime[];
}

/** A candidate as returned by a source, before scoring. */
export interface RecommendationCandidate {
  anime: Anime;
  /** Number of users on the source who endorsed this pairing (may be ≤ 0). */
  votes: number;
}
