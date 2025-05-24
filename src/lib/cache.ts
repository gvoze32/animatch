import type { AnimeData, RecommendationResult } from "./data-sources/base.js";

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class AnimeCache {
  private searchCache = new Map<string, CacheItem<AnimeData[]>>();
  private detailsCache = new Map<string, CacheItem<AnimeData>>();
  private recommendationsCache = new Map<string, CacheItem<AnimeData[]>>();

  private readonly defaultTTL = 1000 * 60 * 30; // 30 minutes
  private readonly searchTTL = 1000 * 60 * 15; // 15 minutes for search results
  private readonly detailsTTL = 1000 * 60 * 60; // 1 hour for details
  private readonly maxCacheSize = 1000;

  // Search cache methods
  getSearchResults(query: string, options?: any): AnimeData[] | null {
    const cacheKey = this.generateSearchKey(query, options);
    const item = this.searchCache.get(cacheKey);

    if (!item) return null;

    if (this.isExpired(item)) {
      this.searchCache.delete(cacheKey);
      return null;
    }

    return item.data;
  }

  setSearchResults(query: string, options: any, data: AnimeData[]): void {
    this.cleanup(this.searchCache);

    const cacheKey = this.generateSearchKey(query, options);
    this.searchCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: this.searchTTL,
    });
  }

  // Details cache methods
  getAnimeDetails(id: string): AnimeData | null {
    const item = this.detailsCache.get(id);

    if (!item) return null;

    if (this.isExpired(item)) {
      this.detailsCache.delete(id);
      return null;
    }

    return item.data;
  }

  setAnimeDetails(id: string, data: AnimeData): void {
    this.cleanup(this.detailsCache);

    this.detailsCache.set(id, {
      data,
      timestamp: Date.now(),
      ttl: this.detailsTTL,
    });
  }

  // Recommendations cache methods
  getRecommendations(animeId: string): AnimeData[] | null {
    const item = this.recommendationsCache.get(animeId);

    if (!item) return null;

    if (this.isExpired(item)) {
      this.recommendationsCache.delete(animeId);
      return null;
    }

    return item.data;
  }

  setRecommendations(animeId: string, data: AnimeData[]): void {
    this.cleanup(this.recommendationsCache);

    this.recommendationsCache.set(animeId, {
      data,
      timestamp: Date.now(),
      ttl: this.defaultTTL,
    });
  }

  // Utility methods
  clear(): void {
    this.searchCache.clear();
    this.detailsCache.clear();
    this.recommendationsCache.clear();
  }

  getStats(): {
    searchEntries: number;
    detailsEntries: number;
    recommendationsEntries: number;
    totalSize: number;
  } {
    return {
      searchEntries: this.searchCache.size,
      detailsEntries: this.detailsCache.size,
      recommendationsEntries: this.recommendationsCache.size,
      totalSize:
        this.searchCache.size +
        this.detailsCache.size +
        this.recommendationsCache.size,
    };
  }

  private generateSearchKey(query: string, options: any = {}): string {
    const optionsStr = JSON.stringify(options);
    return `${query.toLowerCase().trim()}-${optionsStr}`;
  }

  private isExpired<T>(item: CacheItem<T>): boolean {
    return Date.now() - item.timestamp > item.ttl;
  }

  private cleanup<T>(cache: Map<string, CacheItem<T>>): void {
    // Remove expired items
    const now = Date.now();
    for (const [key, item] of cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        cache.delete(key);
      }
    }

    // If still too large, remove oldest items
    if (cache.size > this.maxCacheSize) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, cache.size - this.maxCacheSize);
      toRemove.forEach(([key]) => cache.delete(key));
    }
  }
}

// Singleton cache instance
export const animeCache = new AnimeCache();
