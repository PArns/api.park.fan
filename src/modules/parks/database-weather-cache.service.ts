import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeatherCacheService } from './weather-cache.interface.js';
import {
  WeatherData as WeatherDataEntity,
  WeatherDataType,
} from './weather-cache.entity.js';
import { WeatherData } from './weather.dto.js';

@Injectable()
export class DatabaseWeatherCacheService implements WeatherCacheService {
  private readonly logger = new Logger(DatabaseWeatherCacheService.name);

  constructor(
    @InjectRepository(WeatherDataEntity)
    private readonly weatherDataRepository: Repository<WeatherDataEntity>,
  ) {}

  /**
   * Generate string ID for database storage (park-specific only)
   */
  private getWeatherDataId(
    parkId: number,
    date: string,
    dataType: WeatherDataType,
    daysAhead?: number,
  ): string {
    const baseId = `park_${parkId}_${date}_${dataType}`;
    return daysAhead !== undefined ? `${baseId}_${daysAhead}` : baseId;
  }

  /**
   * Store weather data for a specific park (for historical/forecast data)
   */
  async setWeatherForPark(
    parkId: number,
    date: Date,
    data: WeatherData,
    dataType: WeatherDataType,
    daysAhead?: number,
    ttlHours: number = 24,
  ): Promise<void> {
    const now = new Date();
    const validUntil = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
    const dateString = date.toISOString().split('T')[0];
    const weatherId = this.getWeatherDataId(
      parkId,
      dateString,
      dataType,
      daysAhead,
    );

    try {
      // Check if entry already exists and update it, or create new one
      let existingEntry = await this.weatherDataRepository.findOne({
        where: { id: weatherId },
      });

      if (existingEntry) {
        // Update existing entry
        existingEntry.temperatureMin = data.temperature.min;
        existingEntry.temperatureMax = data.temperature.max;
        existingEntry.precipitationProbability = data.precipitationProbability;
        existingEntry.weatherCode = data.weatherCode;
        existingEntry.status = data.status;
        existingEntry.weatherScore = data.weatherScore;
        existingEntry.forecastCreatedDate =
          dataType === WeatherDataType.FORECAST
            ? now
            : existingEntry.forecastCreatedDate;
        existingEntry.validUntil = validUntil;
        existingEntry.isFetchFailed = false;
        existingEntry.updatedAt = now;
      } else {
        // Create new entry
        existingEntry = this.weatherDataRepository.create({
          id: weatherId,
          parkId,
          weatherDate: date,
          dataType,
          temperatureMin: data.temperature.min,
          temperatureMax: data.temperature.max,
          precipitationProbability: data.precipitationProbability,
          weatherCode: data.weatherCode,
          status: data.status,
          weatherScore: data.weatherScore,
          forecastCreatedDate:
            dataType === WeatherDataType.FORECAST ? now : undefined,
          daysAhead,
          validUntil,
          isFetchFailed: false,
        });
      }

      await this.weatherDataRepository.save(existingEntry);
      this.logger.debug(
        `Stored ${dataType} weather data for park ${parkId} on ${dateString}`,
      );
    } catch (error) {
      this.logger.error(
        `Error storing ${dataType} weather data for park ${parkId}:`,
        error,
      );
    }
  }

  /**
   * Get historical weather data for a park
   */
  async getHistoricalWeatherForPark(
    parkId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<WeatherDataEntity[]> {
    try {
      return await this.weatherDataRepository
        .createQueryBuilder('wd')
        .where('wd.parkId = :parkId', { parkId })
        .andWhere('wd.weatherDate >= :startDate', { startDate })
        .andWhere('wd.weatherDate <= :endDate', { endDate })
        .andWhere('wd.dataType = :dataType', {
          dataType: WeatherDataType.HISTORICAL,
        })
        .orderBy('wd.weatherDate', 'ASC')
        .getMany();
    } catch (error) {
      this.logger.error(
        `Error retrieving historical weather for park ${parkId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Clear all weather data
   */
  async clear(): Promise<void> {
    try {
      const result = await this.weatherDataRepository.delete({});
      this.logger.log(
        `Cleared weather data: ${result.affected || 0} entries removed`,
      );
    } catch (error) {
      this.logger.error('Error clearing weather data:', error);
    }
  }

  /**
   * Clear expired entries from database
   */
  async clearExpired(): Promise<number> {
    try {
      const now = new Date();
      const result = await this.weatherDataRepository
        .createQueryBuilder()
        .delete()
        .where('validUntil < :now', { now })
        .execute();

      const removed = result.affected || 0;
      if (removed > 0) {
        this.logger.debug(
          `Cleaned up ${removed} expired weather data entries from database`,
        );
      }

      return removed;
    } catch (error) {
      this.logger.error(
        'Error cleaning up expired weather data entries:',
        error,
      );
      return 0;
    }
  }

  /**
   * Get all park IDs that need weather updates for today
   */
  async getParksForWeatherUpdate(date?: Date): Promise<number[]> {
    const targetDate = date || new Date();
    const dateString = targetDate.toISOString().split('T')[0];

    try {
      // Get all parks that don't have valid current weather data for today
      const result = await this.weatherDataRepository.query(
        `
        SELECT DISTINCT p.id
        FROM park p
        LEFT JOIN weather_data wd ON (
          wd.park_id = p.id 
          AND wd."weatherDate"::date = $1::date
          AND wd."dataType" = 'current'
          AND wd."validUntil" > NOW()
          AND wd."isFetchFailed" = false
        )
        WHERE wd.id IS NULL
      `,
        [dateString],
      );

      return result.map((row) => parseInt(row.id));
    } catch (error) {
      this.logger.error('Error getting parks for weather update:', error);
      // Fallback: return all active parks
      try {
        const fallbackResult = await this.weatherDataRepository.query(`
          SELECT p.id FROM park p LIMIT 50
        `);
        return fallbackResult.map((row) => parseInt(row.id));
      } catch (fallbackError) {
        this.logger.error('Fallback query also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Get current weather data for a park (today's data)
   */
  async getCurrentWeatherForPark(
    parkId: number,
  ): Promise<WeatherDataEntity | null> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day

      // First try to get current weather data for today
      let weatherData = await this.weatherDataRepository
        .createQueryBuilder('wd')
        .where('wd.parkId = :parkId', { parkId })
        .andWhere('wd.weatherDate = :today', { today })
        .andWhere('wd.dataType = :dataType', {
          dataType: WeatherDataType.CURRENT,
        })
        .andWhere('wd.validUntil > :now', { now: new Date() })
        .getOne();

      // If no current data, try historical data for today
      if (!weatherData) {
        weatherData = await this.weatherDataRepository
          .createQueryBuilder('wd')
          .where('wd.parkId = :parkId', { parkId })
          .andWhere('wd.weatherDate = :today', { today })
          .andWhere('wd.dataType = :dataType', {
            dataType: WeatherDataType.HISTORICAL,
          })
          .andWhere('wd.validUntil > :now', { now: new Date() })
          .getOne();
      }

      // If still no data, try forecast data for today as fallback
      if (!weatherData) {
        weatherData = await this.weatherDataRepository
          .createQueryBuilder('wd')
          .where('wd.parkId = :parkId', { parkId })
          .andWhere('wd.weatherDate = :today', { today })
          .andWhere('wd.dataType = :dataType', {
            dataType: WeatherDataType.FORECAST,
          })
          .andWhere('wd.validUntil > :now', { now: new Date() })
          .getOne();
      }

      return weatherData;
    } catch (error) {
      this.logger.error(
        `Error retrieving current weather for park ${parkId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get forecast weather data for a park (next 7 days)
   */
  async getForecastWeatherForPark(
    parkId: number,
  ): Promise<WeatherDataEntity[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day

      const forecasts = await this.weatherDataRepository
        .createQueryBuilder('wd')
        .where('wd.parkId = :parkId', { parkId })
        .andWhere('wd.weatherDate >= :today', { today })
        .andWhere('wd.dataType = :dataType', {
          dataType: WeatherDataType.FORECAST,
        })
        .andWhere('wd.validUntil > :now', { now: new Date() })
        .orderBy('wd.weatherDate', 'ASC')
        .limit(7) // Limit to 7 days
        .getMany();

      return forecasts;
    } catch (error) {
      this.logger.error(
        `Error retrieving forecast weather for park ${parkId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get combined current weather and forecast for a park
   */
  async getCompleteWeatherForPark(parkId: number): Promise<{
    current: WeatherDataEntity | null;
    forecast: WeatherDataEntity[];
  }> {
    try {
      const [current, forecast] = await Promise.all([
        this.getCurrentWeatherForPark(parkId),
        this.getForecastWeatherForPark(parkId),
      ]);

      return { current, forecast };
    } catch (error) {
      this.logger.error(
        `Error retrieving complete weather for park ${parkId}:`,
        error,
      );
      return { current: null, forecast: [] };
    }
  }

  /**
   * Get weather data for multiple parks in batch
   */
  async getBatchCompleteWeatherForParks(parkIds: number[]): Promise<
    Map<
      number,
      {
        current: WeatherDataEntity | null;
        forecast: WeatherDataEntity[];
      }
    >
  > {
    const results = new Map<
      number,
      {
        current: WeatherDataEntity | null;
        forecast: WeatherDataEntity[];
      }
    >();

    try {
      // Process parks in parallel
      const weatherPromises = parkIds.map(async (parkId) => {
        const weatherData = await this.getCompleteWeatherForPark(parkId);
        results.set(parkId, weatherData);
      });

      await Promise.all(weatherPromises);
    } catch (error) {
      this.logger.error(
        `Error retrieving batch weather for parks ${parkIds.join(', ')}:`,
        error,
      );
    }

    return results;
  }

  /**
   * Convert forecasts to historical data when they become past dates
   */
  async convertForecastsToHistorical(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day

      // Find all forecasts that are now in the past
      const pastForecasts = await this.weatherDataRepository
        .createQueryBuilder('wd')
        .where('wd.dataType = :dataType', {
          dataType: WeatherDataType.FORECAST,
        })
        .andWhere('wd.weatherDate < :today', { today })
        .getMany();

      let converted = 0;
      for (const forecast of pastForecasts) {
        // Create historical entry
        const historicalEntry = this.weatherDataRepository.create({
          ...forecast,
          id: this.getWeatherDataId(
            forecast.parkId || null,
            forecast.weatherDate.toISOString().split('T')[0],
            WeatherDataType.HISTORICAL,
          ),
          dataType: WeatherDataType.HISTORICAL,
          validUntil: new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000), // Keep historical data for 1 year
        });

        await this.weatherDataRepository.save(historicalEntry);
        await this.weatherDataRepository.remove(forecast);
        converted++;
      }

      if (converted > 0) {
        this.logger.log(
          `Converted ${converted} forecast entries to historical data`,
        );
      }

      return converted;
    } catch (error) {
      this.logger.error(
        'Error converting forecasts to historical data:',
        error,
      );
      return 0;
    }
  }
}
