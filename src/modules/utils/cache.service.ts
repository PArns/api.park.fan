import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  CacheEntry,
  CacheConfig,
  ICacheService,
  CacheStats,
} from './cache.interface';

@Injectable()
export class CacheService implements ICacheService, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;
  private readonly config: Required<CacheConfig>;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(private readonly configService: ConfigService) {
    this.config = {
      defaultTtl: this.configService.get<number>(
        'CACHE_DEFAULT_TTL',
        24 * 60 * 60 * 1000,
      ), // 24 hours (longer for queue time data)
      maxSize: this.configService.get<number>('CACHE_MAX_SIZE', 10000),
      cleanupInterval: this.configService.get<number>(
        'CACHE_CLEANUP_INTERVAL',
        60 * 5000,
      ), // 5 minutes
    };

    // Initialize Redis connection
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      username: this.configService.get<string>('REDIS_USER'),
      password: this.configService.get<string>('REDIS_PASS'),
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keyPrefix: 'parkfan:cache:',
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis cache');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis cache connection error:', error);
    });

    this.logger.log(`Cache service initialized with Redis backend`);
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.log('Redis connection closed');
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    // For backward compatibility with sync interface, we return null
    // Users should use getAsync for Redis operations
    this.stats.misses++;
    return null;
  }

  /**
   * Get value from cache (async version)
   */
  async getAsync<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);

      if (!value) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    try {
      const ttl = ttlSeconds || Math.floor(this.config.defaultTtl / 1000);
      const serializedValue = JSON.stringify(value);

      if (ttl > 0) {
        this.redis.setex(key, ttl, serializedValue);
      } else {
        this.redis.set(key, serializedValue);
      }
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}:`, error);
    }
  }

  /**
   * Set value in cache with TTL (async version)
   */
  async setAsync<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds || Math.floor(this.config.defaultTtl / 1000);
      const serializedValue = JSON.stringify(value);

      if (ttl > 0) {
        await this.redis.setex(key, ttl, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}:`, error);
    }
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    try {
      // Fire and forget for sync compatibility
      this.redis.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache (async version)
   */
  async deleteAsync(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    try {
      // Fire and forget for sync compatibility
      this.redis.keys('*').then((keys) => {
        if (keys.length > 0) {
          this.redis.del(...keys);
        }
      });
      this.logger.log('Cache clear initiated');
    } catch (error) {
      this.logger.error('Error clearing cache:', error);
    }
  }

  /**
   * Clear all cache entries (async version)
   */
  async clearAsync(): Promise<void> {
    try {
      const keys = await this.redis.keys('*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      this.logger.log('Cache cleared');
    } catch (error) {
      this.logger.error('Error clearing cache:', error);
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    // For backward compatibility with sync interface
    return false;
  }

  /**
   * Check if key exists in cache (async version)
   */
  async hasAsync(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error checking cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    // For backward compatibility with sync interface
    return 0;
  }

  /**
   * Get cache size (async version)
   */
  async sizeAsync(): Promise<number> {
    try {
      return await this.redis.dbsize();
    } catch (error) {
      this.logger.error('Error getting cache size:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const cacheSize = this.size();
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      entries: cacheSize,
    };
  }

  /**
   * Get cache statistics (async version)
   */
  async getStatsAsync(): Promise<CacheStats> {
    const cacheSize = await this.sizeAsync();
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      entries: cacheSize,
    };
  }

  /**
   * Get Redis client for advanced operations
   */
  getRedisClient(): Redis {
    return this.redis;
  }
}
