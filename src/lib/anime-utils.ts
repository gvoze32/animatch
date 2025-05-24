// Utility functions for working with the new AnimeData structure
import type { AnimeData } from "./data-sources/base";

/**
 * Get the best available title for an anime
 */
export function getAnimeTitle(anime: AnimeData): string {
  return (
    anime.title.common ||
    anime.title.english ||
    anime.title.romaji ||
    anime.title.native ||
    "Unknown Title"
  );
}

/**
 * Format anime score for display
 */
export function formatScore(score?: number): string {
  if (!score) return "N/A";

  // Clamp score to reasonable range (0-100)
  // This fixes the bug where scores can get inflated beyond 100%
  const clampedScore = Math.min(100, Math.max(0, score));

  // Round to 1 decimal place for cleaner display
  const roundedScore = Math.round(clampedScore * 10) / 10;

  return `${roundedScore}%`;
}

/**
 * Format episode count for display
 */
export function formatEpisodes(episodes?: number): string {
  if (!episodes) return "Unknown";
  return `${episodes} episodes`;
}

/**
 * Get a color class for a genre badge
 */
export function getGenreColor(genre: string): string {
  const colors: Record<string, string> = {
    Action: "bg-red-500/10 text-red-400 border-red-500/20",
    Adventure: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    Comedy: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    Drama: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    Fantasy: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    Horror: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    Romance: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    "Sci-Fi": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "Slice of Life": "bg-green-500/10 text-green-400 border-green-500/20",
    Sports: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Supernatural: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    Thriller: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  return colors[genre] || "bg-gray-500/10 text-gray-400 border-gray-500/20";
}

/**
 * Get the best available cover image URL
 */
export function getCoverImage(anime: AnimeData): string {
  return (
    anime.coverImage?.large ||
    anime.coverImage?.medium ||
    anime.coverImage?.small ||
    "/placeholder-anime.jpg"
  );
}

/**
 * Strip HTML tags from a string
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ");
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/**
 * Format anime status for display
 */
export function formatStatus(status?: AnimeData["status"]): string {
  switch (status) {
    case "FINISHED":
      return "Finished";
    case "RELEASING":
      return "Releasing";
    case "NOT_YET_RELEASED":
      return "Not Yet Released";
    case "CANCELLED":
      return "Cancelled";
    case "HIATUS":
      return "Hiatus";
    default:
      return "Unknown";
  }
}

/**
 * Format date for display
 */
export function formatDate(date?: {
  year?: number;
  month?: number;
  day?: number;
}): string {
  if (!date?.year) return "Unknown";

  if (date.month && date.day) {
    return new Date(date.year, date.month - 1, date.day).toLocaleDateString();
  } else if (date.month) {
    return `${date.month}/${date.year}`;
  } else {
    return date.year.toString();
  }
}

/**
 * Get data source badge color
 */
export function getSourceColor(source: string): string {
  switch (source.toLowerCase()) {
    case "anilist":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "myanimelist":
      return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    case "kitsu":
      return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    default:
      return "bg-gray-500/10 text-gray-400 border-gray-500/20";
  }
}
