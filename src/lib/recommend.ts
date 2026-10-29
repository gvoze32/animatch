import { groupFranchises } from "./franchise";
import { sharesId } from "./merge";
import type {
  Anime,
  Recommendation,
  RecommendationCandidate,
  RecommendationReason,
  Tag,
} from "./types";

/** Content-similarity weights; sum to 1. Rating is deliberately absent (it's a tiebreaker). */
const CONTENT_WEIGHTS = {
  genres: 0.4,
  tags: 0.45,
  studio: 0.05,
  year: 0.1,
};

/** Share of the match taken by community endorsement. */
const COMMUNITY_WEIGHT = 0.4;
/** Vote count treated as full endorsement; below it endorsement grows logarithmically. */
const FULL_ENDORSEMENT_VOTES = 1000;
/** Only the source's most relevant tags define what "similar" means. */
const SOURCE_TAG_LIMIT = 12;
/** Cast descriptors like "Male Protagonist" count for less than story/setting tags. */
const GENERIC_TAG_FACTOR = 0.3;

const tagWeight = (tag: Tag) => tag.rank * (tag.generic ? GENERIC_TAG_FACTOR : 1);

const lower = (values: string[]) => new Set(values.map((v) => v.toLowerCase()));

/** How much of the source's genre profile the candidate covers, lightly penalising extras. */
function genreSimilarity(source: string[], candidate: string[]): number {
  if (source.length === 0 || candidate.length === 0) return 0;
  const sourceSet = lower(source);
  const candidateSet = lower(candidate);
  let shared = 0;
  for (const genre of sourceSet) if (candidateSet.has(genre)) shared++;
  const coverage = shared / sourceSet.size;
  const jaccard = shared / (sourceSet.size + candidateSet.size - shared);
  return 0.7 * coverage + 0.3 * jaccard;
}

/** Weighted share of the source's defining tags that the candidate also has. */
function tagSimilarity(source: Tag[], candidate: Tag[]): number {
  const defining = [...source].sort((a, b) => tagWeight(b) - tagWeight(a)).slice(0, SOURCE_TAG_LIMIT);
  if (defining.length === 0 || candidate.length === 0) return 0;
  const candidateRanks = new Map(candidate.map((t) => [t.name.toLowerCase(), t.rank]));
  let matched = 0;
  let total = 0;
  for (const tag of defining) {
    const factor = tag.generic ? GENERIC_TAG_FACTOR : 1;
    total += tag.rank * factor;
    matched += Math.min(tag.rank, candidateRanks.get(tag.name.toLowerCase()) ?? 0) * factor;
  }
  return total === 0 ? 0 : matched / total;
}

export function contentSimilarity(source: Anime, candidate: Anime): number {
  const sourceStudios = lower(source.studios);
  const studio = candidate.studios.some((s) => sourceStudios.has(s.toLowerCase())) ? 1 : 0;
  const year =
    source.year && candidate.year ? Math.max(0, 1 - Math.abs(source.year - candidate.year) / 15) : 0;

  return (
    CONTENT_WEIGHTS.genres * genreSimilarity(source.genres, candidate.genres) +
    CONTENT_WEIGHTS.tags * tagSimilarity(source.tags, candidate.tags) +
    CONTENT_WEIGHTS.studio * studio +
    CONTENT_WEIGHTS.year * year
  );
}

/** 0-1 match that depends only on this pair, not on the rest of the list. */
export function matchScore(source: Anime, candidate: RecommendationCandidate): number {
  const votes = Math.max(0, candidate.votes);
  const community = Math.min(1, Math.log1p(votes) / Math.log1p(FULL_ENDORSEMENT_VOTES));
  return COMMUNITY_WEIGHT * community + (1 - COMMUNITY_WEIGHT) * contentSimilarity(source, candidate.anime);
}

function explain(source: Anime, candidate: RecommendationCandidate): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];
  const { anime, votes } = candidate;

  const candidateGenres = lower(anime.genres);
  for (const genre of source.genres.filter((g) => candidateGenres.has(g.toLowerCase())).slice(0, 3)) {
    reasons.push({ type: "genre", label: genre });
  }

  const candidateTags = new Map(anime.tags.map((t) => [t.name.toLowerCase(), t.rank]));
  source.tags
    .filter((tag) => !tag.generic)
    .map((tag) => ({ name: tag.name, rank: Math.min(tag.rank, candidateTags.get(tag.name.toLowerCase()) ?? 0) }))
    .filter((tag) => tag.rank >= 60)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 2)
    .forEach((tag) => reasons.push({ type: "tag", label: tag.name }));

  const sourceStudios = lower(source.studios);
  const studio = anime.studios.find((s) => sourceStudios.has(s.toLowerCase()));
  if (studio) reasons.push({ type: "studio", label: studio });

  if (votes > 0) {
    reasons.push({ type: "community", label: `${votes} fan${votes === 1 ? "" : "s"} recommend` });
  }
  return reasons;
}

export interface RankOptions {
  includeAdult?: boolean;
  limit?: number;
}

export interface RankedRecommendations {
  recommendations: Recommendation[];
  /** Candidates from the source's own franchise (sequels, spin-offs…), oldest first. */
  sameSeries: Anime[];
}

/** Same displayed percentage → better-rated title first. */
function compareRecommendations(a: Recommendation, b: Recommendation): number {
  return (
    Math.round(b.score * 100) - Math.round(a.score * 100) ||
    (b.anime.averageScore ?? 0) - (a.anime.averageScore ?? 0)
  );
}

/**
 * Scores candidates, moves the source's own franchise into `sameSeries`, and
 * collapses every other franchise into its best-matching entry.
 */
export function rankRecommendations(
  source: Anime,
  candidates: RecommendationCandidate[],
  { includeAdult = false, limit = 24 }: RankOptions = {},
): RankedRecommendations {
  const eligible = candidates.filter(
    (c) => c.votes >= 0 && !sharesId(c.anime.ids, source.ids) && (includeAdult || !c.anime.isAdult),
  );
  const [sourceGroup, ...groups] = groupFranchises([source, ...eligible.map((c) => c.anime)]);

  const sameSeries: Anime[] = [];
  const byGroup = new Map<number, { recommendation: Recommendation; votes: number }[]>();
  eligible.forEach((candidate, index) => {
    const group = groups[index];
    if (group === sourceGroup) {
      sameSeries.push(candidate.anime);
      return;
    }
    const recommendation: Recommendation = {
      anime: candidate.anime,
      score: matchScore(source, candidate),
      reasons: explain(source, candidate),
      related: [],
    };
    byGroup.set(group, [...(byGroup.get(group) ?? []), { recommendation, votes: candidate.votes }]);
  });

  // A franchise is shown as its earliest entry among those fans endorse about as
  // much as the most-voted one (first season / definitive version), but ranked
  // by its best-matching entry.
  const recommendations = [...byGroup.values()].map((members) => {
    const best = Math.max(...members.map((m) => m.recommendation.score));
    const topVotes = Math.max(...members.map((m) => m.votes));
    const byYear = (a: Anime, b: Anime) => (a.year ?? 9999) - (b.year ?? 9999);
    const lead = members
      .filter((m) => m.votes * 1.5 >= topVotes)
      .map((m) => m.recommendation)
      .sort((a, b) => byYear(a.anime, b.anime))[0];
    return {
      ...lead,
      score: best,
      related: members.map((m) => m.recommendation.anime).filter((a) => a !== lead.anime).sort(byYear),
    };
  });

  return {
    recommendations: recommendations.sort(compareRecommendations).slice(0, limit),
    sameSeries: sameSeries.sort((a, b) => (a.year ?? 0) - (b.year ?? 0)),
  };
}
