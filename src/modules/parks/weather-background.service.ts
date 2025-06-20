import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WeatherService } from './weather.service.js';
import { DatabaseWeatherCacheService } from './database-weather-cache.service.js';
import { WeatherDataType } from './weather-cache.entity.js';

@Injectable()
export class WeatherBackgroundService implements OnModuleInit {
  private readonly logger = new Logger(WeatherBackgroundService.name);
  private isRunning = false;
  private isForecastRunning = false;

  constructor(
    private readonly weatherService: WeatherService,
    private readonly databaseCacheService: DatabaseWeatherCacheService,
  ) {}

  /**
   * Initialize weather data when the module starts
   */
  async onModuleInit(): Promise<void> {
    this.logger.log(
      'Weather background service initialized - starting initial weather update...',
    );

    // Small delay to ensure database is ready
    setTimeout(() => {
      this.updateWeatherData();
    }, 5000);
  }

  /**
   * Run current weather updates every 4 hours during the day
   */
  @Cron('0 6,10,14,18,22 * * *')
  async updateWeatherData(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Weather update already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('Starting background weather data update...');

      // Get all locations that need weather updates for today
      const locations = await this.databaseCacheService.getLocationsForUpdate();

      if (locations.length === 0) {
        this.logger.log('No locations need weather updates');
        return;
      }

      this.logger.log(
        `Updating weather data for ${locations.length} locations`,
      );

      let successCount = 0;
      let failureCount = 0;

      // Process locations in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);

        // Process batch in parallel but wait for completion before next batch
        const promises = batch.map(async (location) => {
          try {
            // Use the weather service which already handles caching and rate limiting
            const weatherData = await this.weatherService.getWeatherForLocation(
              location.latitude,
              location.longitude,
              location.timezone,
            );

            if (weatherData) {
              successCount++;
              this.logger.debug(
                `Successfully updated weather for ${location.latitude},${location.longitude}`,
              );

              // If this location has a parkId, also store as park-specific data
              if (location.parkId) {
                await this.databaseCacheService.setWeatherForPark(
                  location.parkId,
                  new Date(),
                  weatherData,
                  WeatherDataType.CURRENT,
                  undefined,
                  12, // 12 hour TTL for current weather
                );
              }
            } else {
              failureCount++;
              this.logger.warn(
                `Failed to get weather data for ${location.latitude},${location.longitude}`,
              );
            }
          } catch (error) {
            failureCount++;
            this.logger.error(
              `Error updating weather for ${location.latitude},${location.longitude}:`,
              error,
            );
          }
        });

        await Promise.all(promises);

        // Small delay between batches to be respectful to the API
        if (i + batchSize < locations.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Weather update completed: ${successCount} successful, ${failureCount} failed, ${duration}ms duration`,
      );

      // Clean up expired entries after update
      const cleanedCount = await this.databaseCacheService.clearExpired();
      if (cleanedCount > 0) {
        this.logger.log(
          `Cleaned up ${cleanedCount} expired weather cache entries`,
        );
      }

      // Convert old forecasts to historical data
      const convertedCount =
        await this.databaseCacheService.convertForecastsToHistorical();
      if (convertedCount > 0) {
        this.logger.log(
          `Converted ${convertedCount} forecasts to historical data`,
        );
      }
    } catch (error) {
      this.logger.error('Error during weather update:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Update weather forecasts daily at 5:00 AM
   */
  @Cron('0 5 * * *')
  async updateWeatherForecasts(): Promise<void> {
    if (this.isForecastRunning) {
      this.logger.warn('Forecast update already running, skipping...');
      return;
    }

    this.isForecastRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('Starting weather forecast update...');

      // Get all active parks for forecast updates
      const locations = await this.databaseCacheService.getLocationsForUpdate();

      if (locations.length === 0) {
        this.logger.log('No locations need forecast updates');
        return;
      }

      this.logger.log(
        `Updating weather forecasts for ${locations.length} locations`,
      );

      let successCount = 0;
      let failureCount = 0;

      // Process forecast updates in smaller batches (forecasts are more expensive)
      const batchSize = 3;
      for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);

        const promises = batch.map(async (location) => {
          try {
            // Fetch 7-day forecast
            const forecastData = await this.weatherService.fetchWeatherForecast(
              location.latitude,
              location.longitude,
              location.timezone,
              7,
            );

            if (forecastData && location.parkId) {
              // Store each forecast day as separate entry
              for (const forecast of forecastData) {
                await this.databaseCacheService.setWeatherForPark(
                  location.parkId,
                  forecast.date,
                  forecast.weather,
                  WeatherDataType.FORECAST,
                  forecast.daysAhead,
                  24, // 24 hour TTL for forecasts
                );
              }

              successCount++;
              this.logger.debug(
                `Successfully updated forecast for park ${location.parkId}`,
              );
            } else {
              failureCount++;
              this.logger.warn(
                `Failed to get forecast data for ${location.latitude},${location.longitude}`,
              );
            }
          } catch (error) {
            failureCount++;
            this.logger.error(
              `Error updating forecast for ${location.latitude},${location.longitude}:`,
              error,
            );
          }
        });

        await Promise.all(promises);

        // Longer delay between forecast batches
        if (i + batchSize < locations.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Forecast update completed: ${successCount} successful, ${failureCount} failed, ${duration}ms duration`,
      );
    } catch (error) {
      this.logger.error('Error during forecast update:', error);
    } finally {
      this.isForecastRunning = false;
    }
  }

  /**
   * Clean up expired cache entries daily at 3 AM
   */
  @Cron('0 3 * * *')
  async cleanupExpiredEntries(): Promise<void> {
    try {
      const cleanedCount = await this.databaseCacheService.clearExpired();
      if (cleanedCount > 0) {
        this.logger.log(
          `Daily cleanup: removed ${cleanedCount} expired weather cache entries`,
        );
      }

      // Also convert forecasts to historical data
      const convertedCount =
        await this.databaseCacheService.convertForecastsToHistorical();
      if (convertedCount > 0) {
        this.logger.log(
          `Daily cleanup: converted ${convertedCount} forecasts to historical data`,
        );
      }
    } catch (error) {
      this.logger.error('Error during daily weather cache cleanup:', error);
    }
  }

  /**
   * Manual trigger for weather updates (useful for debugging/testing)
   */
  async forceUpdate(): Promise<{
    success: number;
    failed: number;
    duration: number;
  }> {
    if (this.isRunning) {
      throw new Error('Weather update already running');
    }

    const startTime = Date.now();
    this.isRunning = true;

    try {
      const locations = await this.databaseCacheService.getLocationsForUpdate();
      let successCount = 0;
      let failureCount = 0;

      for (const location of locations) {
        try {
          const weatherData = await this.weatherService.getWeatherForLocation(
            location.latitude,
            location.longitude,
            location.timezone,
          );

          if (weatherData) {
            successCount++;

            // Also store as park-specific data if we have a parkId
            if (location.parkId) {
              await this.databaseCacheService.setWeatherForPark(
                location.parkId,
                new Date(),
                weatherData,
                WeatherDataType.CURRENT,
              );
            }
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
          this.logger.error(
            `Error in force update for ${location.latitude},${location.longitude}:`,
            error,
          );
        }
      }

      const duration = Date.now() - startTime;
      return { success: successCount, failed: failureCount, duration };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for forecast updates
   */
  async forceForecastUpdate(): Promise<{
    success: number;
    failed: number;
    duration: number;
  }> {
    if (this.isForecastRunning) {
      throw new Error('Forecast update already running');
    }

    const startTime = Date.now();
    this.isForecastRunning = true;

    try {
      const locations = await this.databaseCacheService.getLocationsForUpdate();
      let successCount = 0;
      let failureCount = 0;

      for (const location of locations) {
        if (!location.parkId) continue; // Only update forecasts for parks with IDs

        try {
          const forecastData = await this.weatherService.fetchWeatherForecast(
            location.latitude,
            location.longitude,
            location.timezone,
            7,
          );

          if (forecastData) {
            for (const forecast of forecastData) {
              await this.databaseCacheService.setWeatherForPark(
                location.parkId,
                forecast.date,
                forecast.weather,
                WeatherDataType.FORECAST,
                forecast.daysAhead,
              );
            }
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
          this.logger.error(
            `Error in force forecast update for park ${location.parkId}:`,
            error,
          );
        }
      }

      const duration = Date.now() - startTime;
      return { success: successCount, failed: failureCount, duration };
    } finally {
      this.isForecastRunning = false;
    }
  }

  /**
   * Get background service status
   */
  getStatus(): { isRunning: boolean; isForecastRunning: boolean } {
    return {
      isRunning: this.isRunning,
      isForecastRunning: this.isForecastRunning,
    };
  }
}
