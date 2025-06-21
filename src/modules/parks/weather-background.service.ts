import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WeatherService } from './weather.service.js';
import { DatabaseWeatherCacheService } from './database-weather-cache.service.js';
import { WeatherDataType } from './weather-cache.entity.js';

@Injectable()
export class WeatherBackgroundService implements OnModuleInit {
  private readonly logger = new Logger(WeatherBackgroundService.name);
  private isRunning = false;

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
    setTimeout(async () => {
      await this.updateWeatherData();
    }, 5000);
  }

  /**
   * Run current weather and forecast updates every 2 hours
   */
  @Cron('0 */2 * * *')
  async updateWeatherData(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Weather update already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('Starting background weather data update (current + forecasts)...');

      // Get all locations that need weather updates for today
      const locations = await this.databaseCacheService.getLocationsForUpdate();

      if (locations.length === 0) {
        this.logger.log('No locations need weather updates');
        return;
      }

      this.logger.log(
        `Updating weather data and forecasts for ${locations.length} locations`,
      );

      let successCount = 0;
      let failureCount = 0;

      // Process locations in batches to avoid overwhelming the API
      const batchSize = 3; // Smaller batch size since we're doing both current + forecast
      for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);

        // Process batch in parallel but wait for completion before next batch
        const promises = batch.map(async (location) => {
          try {
            // Only process locations with parkId to avoid duplicate storage
            if (!location.parkId) {
              this.logger.debug(
                `Skipping location without parkId: ${location.latitude},${location.longitude}`,
              );
              return;
            }

            // Update current weather
            const weatherData = await this.weatherService.getWeatherForLocation(
              location.latitude,
              location.longitude,
              location.timezone,
            );

            if (weatherData) {
              // Delete old forecasts for today (they will be replaced by current data)
              const today = new Date();
              const todayString = today.toISOString().split('T')[0];
              
              await this.databaseCacheService['weatherDataRepository']
                .createQueryBuilder()
                .delete()
                .where('parkId = :parkId', { parkId: location.parkId })
                .andWhere('dataType = :dataType', { dataType: WeatherDataType.FORECAST })
                .andWhere('DATE(weatherDate) = :date', { date: todayString })
                .execute();

              // Store current weather data (only park-specific)
              await this.databaseCacheService.setWeatherForPark(
                location.parkId,
                today,
                weatherData,
                WeatherDataType.CURRENT,
                undefined,
                4, // 4 hour TTL for current weather
              );

              // Update forecasts for future days (as far as API supports)
              try {
                const forecastData = await this.weatherService.fetchWeatherForecast(
                  location.latitude,
                  location.longitude,
                  location.timezone,
                  7, // Get 7-day forecast
                );

                if (forecastData) {
                  // Remove old forecast entries for future days first
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  
                  await this.databaseCacheService['weatherDataRepository']
                    .createQueryBuilder()
                    .delete()
                    .where('parkId = :parkId', { parkId: location.parkId })
                    .andWhere('dataType = :dataType', { dataType: WeatherDataType.FORECAST })
                    .andWhere('weatherDate >= :tomorrow', { tomorrow })
                    .execute();

                  // Store new forecast data for future days
                  for (const forecast of forecastData) {
                    if (forecast.daysAhead > 0) { // Skip today (day 0), we have current data
                      await this.databaseCacheService.setWeatherForPark(
                        location.parkId,
                        forecast.date,
                        forecast.weather,
                        WeatherDataType.FORECAST,
                        forecast.daysAhead,
                        24, // 24 hour TTL for forecasts
                      );
                    }
                  }

                  this.logger.debug(
                    `Updated current weather and ${forecastData.length - 1} forecasts for park ${location.parkId}`,
                  );
                }
              } catch (forecastError) {
                this.logger.warn(
                  `Failed to update forecasts for park ${location.parkId}:`,
                  forecastError,
                );
              }

              successCount++;
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

        // Delay between batches (longer since we're doing more work)
        if (i + batchSize < locations.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Weather update completed: ${successCount} successful, ${failureCount} failed, ${duration}ms duration`,
      );

      // Convert expired current weather data to historical before cleanup
      const convertedExpiredCount = await this.convertExpiredCurrentToHistorical();
      if (convertedExpiredCount > 0) {
        this.logger.log(
          `Converted ${convertedExpiredCount} expired current weather entries to historical data`,
        );
      }

      // Clean up expired entries after update
      const cleanedCount = await this.databaseCacheService.clearExpired();
      if (cleanedCount > 0) {
        this.logger.log(
          `Cleaned up ${cleanedCount} expired weather cache entries`,
        );
      }

      // Note: Forecasts are deleted and replaced, not converted to historical
    } catch (error) {
      this.logger.error('Error during weather update:', error);
    } finally {
      this.isRunning = false;
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
    
    // Temporarily set as running and trigger update
    this.isRunning = true;
    
    try {
      await this.updateWeatherData();
      const duration = Date.now() - startTime;
      
      // Return some basic stats (could be enhanced to track actual counts)
      return { 
        success: 1, // Indicates successful completion
        failed: 0, 
        duration 
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return { 
        success: 0, 
        failed: 1, 
        duration 
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Convert expired current weather data to historical data before cleanup
   */
  private async convertExpiredCurrentToHistorical(): Promise<number> {
    try {
      this.logger.debug('Converting expired current weather data to historical...');

      // Get expired current weather entries that have park IDs (valuable historical data)
      const expiredEntries = await this.databaseCacheService['weatherDataRepository']
        .createQueryBuilder('wd')
        .where('wd.dataType = :dataType', { dataType: WeatherDataType.CURRENT })
        .andWhere('wd.validUntil <= :now', { now: new Date() })
        .andWhere('wd.parkId IS NOT NULL') // Only convert park-specific data
        .andWhere('wd.isFetchFailed = false') // Only convert successful weather data
        .getMany();

      let convertedCount = 0;

      for (const entry of expiredEntries) {
        try {
          // Create historical entry
          const historicalId = `park_${entry.parkId}_${entry.weatherDate.toISOString().split('T')[0]}_historical`;

          // Check if historical entry already exists
          const existingHistorical = await this.databaseCacheService['weatherDataRepository']
            .findOne({ where: { id: historicalId } });

          if (!existingHistorical) {
            const historicalEntry = this.databaseCacheService['weatherDataRepository'].create({
              id: historicalId,
              parkId: entry.parkId,
              weatherDate: entry.weatherDate,
              dataType: WeatherDataType.HISTORICAL,
              temperatureMin: entry.temperatureMin,
              temperatureMax: entry.temperatureMax,
              precipitationProbability: entry.precipitationProbability,
              weatherCode: entry.weatherCode,
              status: entry.status,
              weatherScore: entry.weatherScore,
              validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Keep for 1 year
              isFetchFailed: false,
            });

            await this.databaseCacheService['weatherDataRepository'].save(historicalEntry);
            convertedCount++;

            this.logger.debug(
              `Converted expired current weather for park ${entry.parkId} on ${entry.weatherDate.toISOString().split('T')[0]} to historical`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error converting expired weather entry ${entry.id} to historical:`,
            error,
          );
        }
      }

      if (convertedCount > 0) {
        this.logger.log(
          `Successfully converted ${convertedCount} expired current weather entries to historical data`,
        );
      }

      return convertedCount;
    } catch (error) {
      this.logger.error('Error converting expired current weather to historical:', error);
      return 0;
    }
  }

  /**
   * Get background service status
   */
  getStatus(): { isRunning: boolean } {
    return {
      isRunning: this.isRunning,
    };
  }
}