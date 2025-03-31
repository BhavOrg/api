import { config } from "../config/config";

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

/**
 * Simple in-memory cache implementation
 * This helps optimize frequent database queries
 */
class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = config.feed.cacheTime || 300; // Default 5 minutes

  /**
   * Get a value from the cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    // Return null if entry doesn't exist
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set a value in the cache with optional TTL
   */
  set<T>(key: string, value: T, ttl: number = this.defaultTTL): void {
    const expiry = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiry });
  }

  /**
   * Delete a value from the cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all values from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or set a value using a factory function
   * If the value is not in the cache, the factory function is called to get it
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Not in cache, call factory
    const value = await factory();

    // Store in cache
    this.set(key, value, ttl);

    return value;
  }
}

// Export singleton instance
export const cacheService = new CacheService();
