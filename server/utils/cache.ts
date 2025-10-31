import { logger } from "./logger";

/**
 * In-memory caching system for frequently accessed data
 * Improves performance by reducing database queries
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private stats: CacheStats;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_SIZE = 1000; // Maximum cache entries
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0,
    };
    
    // Start automatic cleanup
    this.startCleanup();
  }

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.deletes++;
      this.updateSize();
      return null;
    }
    
    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Set cached value with optional TTL
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    // Enforce max size - evict oldest entries
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictOldest();
    }
    
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    };
    
    this.cache.set(key, entry);
    this.stats.sets++;
    this.updateSize();
  }

  /**
   * Delete cached value
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.updateSize();
    }
    return deleted;
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string | RegExp): number {
    let deleted = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of Array.from(this.cache.keys())) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    if (deleted > 0) {
      this.stats.deletes += deleted;
      this.updateSize();
    }
    
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.deletes += size;
    this.updateSize();
    logger.info("Cache cleared", { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size,
    };
  }

  /**
   * Get hit rate percentage
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return (this.stats.hits / total) * 100;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get or set pattern - fetch from cache or compute and store
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.deletes++;
    }
  }

  /**
   * Remove expired entries periodically
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      this.stats.deletes += removed;
      this.updateSize();
      logger.debug("Cache cleanup completed", { 
        entriesRemoved: removed,
        remainingEntries: this.cache.size,
      });
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanup(): void {
    // Run cleanup every 2 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 2 * 60 * 1000);
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Update size stat
   */
  private updateSize(): void {
    this.stats.size = this.cache.size;
  }
}

// Export singleton instance
export const cache = new CacheManager();

/**
 * Cache key generators for common data types
 */
export const CacheKeys = {
  // Disaster reports  
  report: (id: string | number) => `report:${id}`,
  reports: (filters: string = '') => `reports:${filters}`,
  reportsNearby: (lat: number, lon: number, radius: number) => 
    `reports:nearby:${lat},${lon},${radius}`,
  
  // User data
  user: (id: number) => `user:${id}`,
  userStats: (id: number) => `user:stats:${id}`,
  
  // Dashboard data
  dashboardStats: () => 'dashboard:stats',
  activeReports: () => 'reports:active',
  
  // Resources
  resources: (filters: string = '') => `resources:${filters}`,
  resourceMatches: (requestId: number) => `resource:matches:${requestId}`,
  
  // Verification
  reportVerifications: (reportId: number) => `verifications:${reportId}`,
  
  // Map data
  heatmapData: (filters: string = '') => `heatmap:${filters}`,
};

/**
 * Cache TTL presets (in milliseconds)
 */
export const CacheTTL = {
  VERY_SHORT: 30 * 1000,      // 30 seconds - real-time data
  SHORT: 2 * 60 * 1000,       // 2 minutes - frequently changing
  MEDIUM: 5 * 60 * 1000,      // 5 minutes - default
  LONG: 15 * 60 * 1000,       // 15 minutes - stable data
  VERY_LONG: 60 * 60 * 1000,  // 1 hour - rarely changing
};
