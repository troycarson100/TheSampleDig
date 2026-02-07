/**
 * Caching layer for YouTube search results and video details
 * Uses in-memory cache with optional Redis support
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private maxSize: number = 10000 // Max 10k entries

  set<T>(key: string, value: T, ttlSeconds: number = 3600): void {
    // If cache is full, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      const keysToDelete = Array.from(this.cache.keys()).slice(0, 1000)
      keysToDelete.forEach(k => this.cache.delete(k))
    }

    const expiresAt = Date.now() + ttlSeconds * 1000
    this.cache.set(key, { data: value, expiresAt })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }
}

// Singleton instance
const memoryCache = new MemoryCache()

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    memoryCache.cleanup()
  }, 5 * 60 * 1000)
}

/**
 * Cache keys
 */
export const CacheKeys = {
  searchResult: (query: string, excludedIds: string[]) => 
    `search:${query}:${excludedIds.sort().join(',')}`,
  videoDetails: (videoId: string) => `video:${videoId}`,
  videoDetailsBatch: (videoIds: string[]) => `video:batch:${videoIds.sort().join(',')}`,
}

/**
 * Cache TTLs (in seconds)
 */
export const CacheTTL = {
  searchResult: 24 * 60 * 60, // 24 hours
  videoDetails: 30 * 24 * 60 * 60, // 30 days (video details rarely change)
  videoDetailsBatch: 30 * 24 * 60 * 60, // 30 days
}

/**
 * Get cached search result
 */
export function getCachedSearchResult<T>(query: string, excludedIds: string[]): T | null {
  const key = CacheKeys.searchResult(query, excludedIds)
  return memoryCache.get<T>(key)
}

/**
 * Cache search result
 */
export function cacheSearchResult<T>(query: string, excludedIds: string[], result: T): void {
  const key = CacheKeys.searchResult(query, excludedIds)
  memoryCache.set(key, result, CacheTTL.searchResult)
}

/**
 * Get cached video details
 */
export function getCachedVideoDetails<T>(videoId: string): T | null {
  const key = CacheKeys.videoDetails(videoId)
  return memoryCache.get<T>(key)
}

/**
 * Cache video details
 */
export function cacheVideoDetails<T>(videoId: string, details: T): void {
  const key = CacheKeys.videoDetails(videoId)
  memoryCache.set(key, details, CacheTTL.videoDetails)
}

/**
 * Get cached batch video details
 */
export function getCachedVideoDetailsBatch<T>(videoIds: string[]): T | null {
  const key = CacheKeys.videoDetailsBatch(videoIds)
  return memoryCache.get<T>(key)
}

/**
 * Cache batch video details
 */
export function cacheVideoDetailsBatch<T>(videoIds: string[], details: T): void {
  const key = CacheKeys.videoDetailsBatch(videoIds)
  memoryCache.set(key, details, CacheTTL.videoDetailsBatch)
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  memoryCache.clear()
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return {
    size: memoryCache.size(),
    maxSize: 10000,
  }
}
