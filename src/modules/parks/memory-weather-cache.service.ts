import { Injectable, Logger } from '@nestjs/common';
import {
  WeatherCacheKey,
  WeatherCacheEntry,
  WeatherCacheService,
} from './weather-cache.interface.js';

@Injectable()
export class MemoryWeatherCacheService implements WeatherCacheService {
  private readonly logger = new Logger(MemoryWeatherCacheService.name);
  private readonly cache = new Map<string, WeatherCacheEntry>();

  /**
   * Generate a cache key from coordinates, timezone and date
   */
  generateKey(
    latitude: number,
    longitude: number,
    timezone: string,
    date?: Date,
  ): WeatherCacheKey {
    const targetDate = date || new Date();
    // Get date in the park's timezone
    const dateString = targetDate.toLocaleDateString('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }); // Returns YYYY-MM-DD format

    return {
      latitude: Math.round(latitude * 1000000) / 1000000, // Round to 6 decimal places
      longitude: Math.round(longitude * 1000000) / 1000000,
      date: dateString,
      timezone,
    };
  }

  /**
   * Generate string key for internal cache storage
   */
  private getStringKey(key: WeatherCacheKey): string {
    return `${key.latitude},${key.longitude},${key.date},${key.timezone}`;
  }

  /**
   * Get weather data from cache
   */
  async get(key: WeatherCacheKey): Promise<any | null> {
    const stringKey = this.getStringKey(key);
    const entry = this.cache.get(stringKey);

    if (!entry) {
      this.logger.debug(`Cache miss for key: ${stringKey}`);
      return null;
    }

    // Check if entry has expired
    if (new Date() > entry.expiresAt) {
      this.logger.debug(`Cache entry expired for key: ${stringKey}`);
      this.cache.delete(stringKey);
      return null;
    }

    this.logger.debug(`Cache hit for key: ${stringKey}`);
    // Return the cached data, even if it's null (to prevent repeated failed requests)
    return entry.data;
  }

  /**
   * Set weather data in cache with TTL
   */
  async set(
    key: WeatherCacheKey,
    data: any,
    ttlHours: number = 6,
  ): Promise<void> {
    const stringKey = this.getStringKey(key);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    const entry: WeatherCacheEntry = {
      data,
      cachedAt: now,
      expiresAt,
    };

    this.cache.set(stringKey, entry);
    this.logger.debug(
      `Cached weather data for key: ${stringKey}, expires at: ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.log(`Cleared weather cache: ${size} entries removed`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{ key: string; cachedAt: Date; expiresAt: Date }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      cachedAt: entry.cachedAt,
      expiresAt: entry.expiresAt,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Cleanup expired entries (can be called periodically)
   */
  cleanupExpired(): number {
    const now = new Date();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} expired cache entries`);
    }

    return removed;
  }

  // Park-specific weather methods (not implemented for memory cache)
  // These delegate to database cache service instead
  async getCurrentWeatherForPark(parkId: number): Promise<any | null> {
    this.logger.debug(
      `Park-specific weather methods not implemented in memory cache for park ${parkId}. Use database cache service instead.`,
    );
    return null;
  }

  async getForecastWeatherForPark(parkId: number): Promise<any[]> {
    this.logger.debug(
      `Park-specific weather methods not implemented in memory cache for park ${parkId}. Use database cache service instead.`,
    );
    return [];
  }

  async getCompleteWeatherForPark(parkId: number): Promise<{
    current: any | null;
    forecast: any[];
  }> {
    this.logger.debug(
      `Park-specific weather methods not implemented in memory cache for park ${parkId}. Use database cache service instead.`,
    );
    return { current: null, forecast: [] };
  }

  async getBatchCompleteWeatherForParks(parkIds: number[]): Promise<Map<number, {
    current: any | null;
    forecast: any[];
  }>> {
    this.logger.debug(
      `Park-specific weather methods not implemented in memory cache for parks ${parkIds.join(', ')}. Use database cache service instead.`,
    );
    return new Map();
  }
}
