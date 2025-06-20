export const WEATHER_CACHE_SERVICE = Symbol('WEATHER_CACHE_SERVICE');

export interface WeatherCacheKey {
  latitude: number;
  longitude: number;
  date: string; // YYYY-MM-DD format
  timezone: string;
}

export interface WeatherCacheEntry {
  data: any; // WeatherData
  cachedAt: Date;
  expiresAt: Date;
}

export interface WeatherCacheService {
  get(key: WeatherCacheKey): Promise<any | null>;
  set(key: WeatherCacheKey, data: any, ttlHours?: number): Promise<void>;
  clear(): Promise<void>;
  generateKey(
    latitude: number,
    longitude: number,
    timezone: string,
    date?: Date,
  ): WeatherCacheKey;
}
