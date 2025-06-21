import { Injectable, Logger, Inject } from '@nestjs/common';
import axios from 'axios';
import {
  WeatherData,
  WeatherStatus,
  OpenMeteoResponse,
} from './weather.dto.js';
import {
  WeatherCacheService,
  WEATHER_CACHE_SERVICE,
} from './weather-cache.interface.js';

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast';
  private readonly requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private readonly maxConcurrentRequests = 3; // Limit concurrent requests
  private activeRequests = 0;

  constructor(
    @Inject(WEATHER_CACHE_SERVICE)
    private readonly cacheService: WeatherCacheService,
  ) {}

  /**
   * Calculate weather score from 0-100% based on multiple factors
   * 100% = Perfect weather for visiting a theme park
   * 0% = Terrible weather conditions
   */
  private calculateWeatherScore(
    weatherCode: number,
    precipitationProbability: number,
    minTemp: number,
    maxTemp: number,
  ): number {
    let score = 100;

    // Weather condition penalties
    if (weatherCode === 0) {
      // Perfect sunny weather
      score = 100;
    } else if (weatherCode >= 1 && weatherCode <= 3) {
      // Partly cloudy to overcast - still good
      score = Math.max(70, score - (weatherCode - 1) * 10);
    } else if (weatherCode >= 45 && weatherCode <= 48) {
      // Fog - significant penalty
      score = Math.max(30, score - 40);
    } else if (weatherCode >= 51 && weatherCode <= 57) {
      // Drizzle - moderate penalty
      score = Math.max(40, score - 35);
    } else if (weatherCode >= 61 && weatherCode <= 67) {
      // Rain - heavy penalty based on intensity
      const rainPenalty = weatherCode <= 63 ? 45 : weatherCode <= 65 ? 60 : 75;
      score = Math.max(15, score - rainPenalty);
    } else if (weatherCode >= 71 && weatherCode <= 86) {
      // Snow - very heavy penalty
      score = Math.max(10, score - 70);
    } else if (weatherCode >= 95 && weatherCode <= 99) {
      // Thunderstorm - extreme penalty
      score = Math.max(5, score - 85);
    }

    // Precipitation probability penalty
    if (precipitationProbability > 20) {
      const precipPenalty = Math.min(
        30,
        (precipitationProbability - 20) * 0.375,
      );
      score = Math.max(0, score - precipPenalty);
    }

    // Temperature comfort scoring
    const optimalTempRange = { min: 18, max: 25 }; // Optimal range for theme park visits
    const comfortableTempRange = { min: 12, max: 30 }; // Comfortable range

    if (
      maxTemp < comfortableTempRange.min ||
      minTemp > comfortableTempRange.max
    ) {
      // Extreme temperatures - heavy penalty
      score = Math.max(0, score - 40);
    } else if (
      maxTemp < optimalTempRange.min ||
      minTemp > optimalTempRange.max
    ) {
      // Sub-optimal but acceptable temperatures - moderate penalty
      const tempPenalty = Math.min(
        25,
        Math.max(
          Math.abs(maxTemp - optimalTempRange.max),
          Math.abs(minTemp - optimalTempRange.min),
        ) * 2,
      );
      score = Math.max(0, score - tempPenalty);
    }

    // Extreme temperature spread penalty
    const tempSpread = maxTemp - minTemp;
    if (tempSpread > 15) {
      const spreadPenalty = Math.min(15, (tempSpread - 15) * 1.5);
      score = Math.max(0, score - spreadPenalty);
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Map weather codes from Open-Meteo to readable status
   * Based on WMO weather interpretation codes
   */
  private mapWeatherCodeToStatus(code: number): WeatherStatus {
    // Clear sky
    if (code === 0) return WeatherStatus.SUNNY;

    // Mainly clear, partly cloudy, and overcast
    if (code >= 1 && code <= 3) {
      if (code === 1) return WeatherStatus.PARTLY_CLOUDY;
      if (code === 2) return WeatherStatus.CLOUDY;
      if (code === 3) return WeatherStatus.OVERCAST;
    }

    // Fog
    if (code >= 45 && code <= 48) return WeatherStatus.FOG;

    // Drizzle
    if (code >= 51 && code <= 57) return WeatherStatus.DRIZZLE;

    // Rain
    if (code >= 61 && code <= 67) {
      if (code <= 63) return WeatherStatus.LIGHT_RAIN;
      if (code <= 65) return WeatherStatus.RAIN;
      return WeatherStatus.HEAVY_RAIN;
    }

    // Snow
    if (code >= 71 && code <= 86) return WeatherStatus.SNOW;

    // Thunderstorm
    if (code >= 95 && code <= 99) return WeatherStatus.THUNDERSTORM;

    // Default fallback
    return WeatherStatus.CLOUDY;
  }

  /**
   * Get weather data for a specific location with caching
   */
  async getWeatherForLocation(
    latitude: number,
    longitude: number,
    timezone: string,
  ): Promise<WeatherData | null> {
    // Ensure coordinates are numbers and handle string inputs from database
    const latNum =
      typeof latitude === 'number' ? latitude : parseFloat(String(latitude));
    const lngNum =
      typeof longitude === 'number' ? longitude : parseFloat(String(longitude));

    // Validate that we have valid numbers
    if (isNaN(latNum) || isNaN(lngNum)) {
      this.logger.error(
        `Invalid coordinates provided: latitude=${latitude}, longitude=${longitude}`,
      );
      return null;
    }

    // Check cache first
    const cacheKey = this.cacheService.generateKey(latNum, lngNum, timezone);
    const cachedData = await this.cacheService.get(cacheKey);

    if (cachedData) {
      this.logger.debug(`Using cached weather data for (${latNum}, ${lngNum})`);
      return cachedData;
    }

    // Fetch fresh data if not in cache
    const weatherData = await this.queueRequest(() =>
      this.fetchWeatherFromAPI(latNum, lngNum, timezone),
    );

    // Cache the result if successful
    if (weatherData) {
      await this.cacheService.set(cacheKey, weatherData, 12); // Cache for 12 hours to reduce API calls
    } else {
      // Cache null results for a shorter time to prevent repeated failed requests
      await this.cacheService.set(cacheKey, null, 1); // Cache for 1 hour
    }

    return weatherData;
  }

  /**
   * Get cached weather data only - never makes API calls
   * This is used for request processing where we don't want to slow down responses
   */
  async getCachedWeatherForLocation(
    latitude: number,
    longitude: number,
    timezone: string,
  ): Promise<WeatherData | null> {
    // Ensure coordinates are numbers and handle string inputs from database
    const latNum =
      typeof latitude === 'number' ? latitude : parseFloat(String(latitude));
    const lngNum =
      typeof longitude === 'number' ? longitude : parseFloat(String(longitude));

    // Validate that we have valid numbers
    if (isNaN(latNum) || isNaN(lngNum)) {
      this.logger.debug(
        `Invalid coordinates provided: latitude=${latitude}, longitude=${longitude}`,
      );
      return null;
    }

    // Only check cache, never fetch from API
    const cacheKey = this.cacheService.generateKey(latNum, lngNum, timezone);
    const cachedData = await this.cacheService.get(cacheKey);

    if (cachedData) {
      this.logger.debug(`Using cached weather data for (${latNum}, ${lngNum})`);
      return cachedData;
    }

    this.logger.debug(
      `No cached weather data available for (${latNum}, ${lngNum})`,
    );
    return null;
  }

  /**
   * Get cached weather data for multiple locations in batch - never makes API calls
   * This is optimized for list views where we need weather for many parks
   */
  async getBatchCachedWeatherForLocations(
    locations: Array<{
      latitude: number;
      longitude: number;
      timezone: string;
      id?: number;
    }>,
  ): Promise<Map<string, WeatherData | null>> {
    const results = new Map<string, WeatherData | null>();

    // Process all locations in parallel for better performance
    const weatherPromises = locations.map(async (location) => {
      const latNum =
        typeof location.latitude === 'number'
          ? location.latitude
          : parseFloat(String(location.latitude));
      const lngNum =
        typeof location.longitude === 'number'
          ? location.longitude
          : parseFloat(String(location.longitude));

      if (isNaN(latNum) || isNaN(lngNum)) {
        return {
          key: `${location.latitude},${location.longitude}`,
          weather: null,
        };
      }

      const cacheKey = this.cacheService.generateKey(
        latNum,
        lngNum,
        location.timezone,
      );
      const cachedData = await this.cacheService.get(cacheKey);

      return {
        key: `${latNum},${lngNum}`,
        weather: cachedData,
      };
    });

    const weatherResults = await Promise.all(weatherPromises);

    weatherResults.forEach((result) => {
      results.set(result.key, result.weather);
    });

    this.logger.debug(
      `Retrieved cached weather data for ${results.size} locations`,
    );
    return results;
  }

  /**
   * Fetch weather data from Open-Meteo API
   */
  private async fetchWeatherFromAPI(
    latitude: number,
    longitude: number,
    timezone: string,
  ): Promise<WeatherData | null> {
    try {
      const params = {
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        timezone,
        daily: [
          'temperature_2m_max',
          'temperature_2m_min',
          'precipitation_probability_max',
          'weather_code',
        ].join(','),
        hourly: [
          'temperature_2m',
          'weather_code',
          'precipitation_probability',
        ].join(','),
        forecast_days: 1,
      };

      const response = await axios.get<OpenMeteoResponse>(this.baseUrl, {
        params,
        timeout: 5000,
      });
      const data = response.data;

      if (!data.daily || data.daily.time.length === 0) {
        this.logger.warn('No weather data received from Open-Meteo API');
        return null;
      }

      // Get today's daily data (first entry)
      const todayIndex = 0;
      const dailyData = data.daily;

      // Get daytime weather data (9-22h) for more accurate status
      const daytimeHours =
        data.hourly?.time
          .map((time, index) => {
            const hour = new Date(time).getHours();
            return hour >= 9 && hour <= 22 ? index : -1;
          })
          .filter((index) => index !== -1) || [];

      // Calculate average weather code during daytime hours
      let avgWeatherCode = dailyData.weather_code[todayIndex];
      if (daytimeHours.length > 0 && data.hourly?.weather_code) {
        const daytimeCodes = daytimeHours.map(
          (index) => data.hourly.weather_code[index],
        );
        avgWeatherCode = Math.round(
          daytimeCodes.reduce((sum, code) => sum + code, 0) /
            daytimeCodes.length,
        );
      }

      const minTemp = Math.round(dailyData.temperature_2m_min[todayIndex]);
      const maxTemp = Math.round(dailyData.temperature_2m_max[todayIndex]);
      const precipitationProbability =
        dailyData.precipitation_probability_max[todayIndex];

      const weatherData: WeatherData = {
        temperature: {
          min: minTemp,
          max: maxTemp,
        },
        precipitationProbability,
        weatherCode: avgWeatherCode,
        status: this.mapWeatherCodeToStatus(avgWeatherCode),
        weatherScore: this.calculateWeatherScore(
          avgWeatherCode,
          precipitationProbability,
          minTemp,
          maxTemp,
        ),
      };

      this.logger.debug(
        `Weather data retrieved for coordinates (${latitude}, ${longitude}): ${JSON.stringify(weatherData)}`,
      );

      return weatherData;
    } catch (error) {
      // Handle specific error cases
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          this.logger.warn(
            `Rate limit exceeded for weather API at coordinates (${latitude}, ${longitude}). Using fallback data.`,
          );

          // Return fallback weather data when rate limited
          return {
            temperature: { min: 20, max: 25 },
            precipitationProbability: 30,
            weatherCode: 2, // Partly cloudy
            status: WeatherStatus.CLOUDY,
            weatherScore: 70,
          };
        } else if (error.code === 'ECONNABORTED') {
          this.logger.warn(
            `Weather API timeout for coordinates (${latitude}, ${longitude})`,
          );
        } else {
          this.logger.error(
            `Weather API error (${error.response?.status || 'unknown'}) for coordinates (${latitude}, ${longitude}):`,
            error.message,
          );
        }
      } else {
        this.logger.error(
          `Unexpected error fetching weather data for coordinates (${latitude}, ${longitude}):`,
          error,
        );
      }
      return null;
    }
  }

  /**
   * Fetch weather forecast data from Open-Meteo API (up to 7 days)
   */
  async fetchWeatherForecast(
    latitude: number,
    longitude: number,
    timezone: string,
    days: number = 7,
  ): Promise<Array<{
    date: Date;
    weather: WeatherData;
    daysAhead: number;
  }> | null> {
    try {
      const params = {
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        timezone,
        daily: [
          'temperature_2m_max',
          'temperature_2m_min',
          'precipitation_probability_max',
          'weather_code',
        ].join(','),
        forecast_days: Math.min(days, 7), // API supports max 7 days for free tier
      };

      const response = await axios.get<OpenMeteoResponse>(this.baseUrl, {
        params,
        timeout: 10000, // Longer timeout for forecast data
      });
      const data = response.data;

      if (!data.daily || data.daily.time.length === 0) {
        this.logger.warn('No forecast data received from Open-Meteo API');
        return null;
      }

      const forecasts: Array<{
        date: Date;
        weather: WeatherData;
        daysAhead: number;
      }> = [];

      for (let i = 0; i < data.daily.time.length; i++) {
        const dateStr = data.daily.time[i];
        const date = new Date(dateStr);

        const minTemp = Math.round(data.daily.temperature_2m_min[i]);
        const maxTemp = Math.round(data.daily.temperature_2m_max[i]);
        const precipitationProbability =
          data.daily.precipitation_probability_max[i];
        const weatherCode = data.daily.weather_code[i];

        const weatherData: WeatherData = {
          temperature: {
            min: minTemp,
            max: maxTemp,
          },
          precipitationProbability,
          weatherCode,
          status: this.mapWeatherCodeToStatus(weatherCode),
          weatherScore: this.calculateWeatherScore(
            weatherCode,
            precipitationProbability,
            minTemp,
            maxTemp,
          ),
        };

        forecasts.push({
          date,
          weather: weatherData,
          daysAhead: i,
        });
      }

      this.logger.debug(
        `Weather forecast retrieved for coordinates (${latitude}, ${longitude}): ${forecasts.length} days`,
      );

      return forecasts;
    } catch (error) {
      this.logger.error(
        `Error fetching weather forecast for coordinates (${latitude}, ${longitude}):`,
        error,
      );
      return null;
    }
  }

  /**
   * Process the request queue to limit concurrent API calls
   */
  private processQueue(): void {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (
      this.requestQueue.length > 0 &&
      this.activeRequests < this.maxConcurrentRequests
    ) {
      const request = this.requestQueue.shift();
      if (request) {
        this.activeRequests++;
        void request().finally(() => {
          this.activeRequests--;
          // Small delay to prevent overwhelming the API
          setTimeout(() => void this.processQueue(), 100);
        });
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Add request to queue
   */
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(
            new Error(error instanceof Error ? error.message : String(error)),
          );
        }
      });
      void this.processQueue();
    });
  }
}
