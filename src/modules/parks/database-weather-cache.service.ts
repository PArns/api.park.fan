import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WeatherCacheKey,
  WeatherCacheService,
} from './weather-cache.interface.js';
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
   * Generate a cache key from coordinates, timezone and date
   */
  generateKey(
    latitude: number,
    longitude: number,
    timezone: string,
    date?: Date,
  ): WeatherCacheKey {
    const targetDate = date || new Date();
    const dateString = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Ensure coordinates are numbers and handle string inputs from database
    const latNum =
      typeof latitude === 'number' ? latitude : parseFloat(String(latitude));
    const lngNum =
      typeof longitude === 'number' ? longitude : parseFloat(String(longitude));

    // Validate that we have valid numbers
    if (isNaN(latNum) || isNaN(lngNum)) {
      throw new Error(
        `Invalid coordinates: latitude=${latitude}, longitude=${longitude}`,
      );
    }

    return {
      latitude: Number(latNum.toFixed(6)),
      longitude: Number(lngNum.toFixed(6)),
      date: dateString,
      timezone,
    };
  }

  /**
   * Generate string ID for database storage
   */
  private getWeatherDataId(
    parkId: number | null,
    date: string,
    dataType: WeatherDataType,
    daysAhead?: number,
  ): string {
    const baseId = parkId
      ? `park_${parkId}_${date}_${dataType}`
      : `coord_${date}_${dataType}`;
    return daysAhead !== undefined ? `${baseId}_${daysAhead}` : baseId;
  }

  /**
   * Generate string ID for coordinate-based weather data storage
   */
  private getCoordinateWeatherDataId(
    latitude: number,
    longitude: number,
    date: string,
    dataType: WeatherDataType,
  ): string {
    // Ensure coordinates are numbers and handle string inputs from database
    const latNum =
      typeof latitude === 'number' ? latitude : parseFloat(String(latitude));
    const lngNum =
      typeof longitude === 'number' ? longitude : parseFloat(String(longitude));

    // Validate that we have valid numbers
    if (isNaN(latNum) || isNaN(lngNum)) {
      throw new Error(
        `Invalid coordinates for weather ID: latitude=${latitude}, longitude=${longitude}`,
      );
    }

    // Round coordinates to 4 decimal places to group nearby locations
    const latRounded = latNum.toFixed(4);
    const lngRounded = lngNum.toFixed(4);
    return `coord_${latRounded}_${lngRounded}_${date}_${dataType}`;
  }

  /**
   * Get weather data from database cache
   */
  async get(key: WeatherCacheKey): Promise<WeatherData | null> {
    try {
      // Try to find by park first (more accurate), then by coordinates
      const weatherEntry = await this.weatherDataRepository
        .createQueryBuilder('wd')
        .leftJoin('wd.park', 'park')
        .where('wd.weatherDate = :date', { date: key.date })
        .andWhere('wd.dataType = :dataType', {
          dataType: WeatherDataType.CURRENT,
        })
        .andWhere(
          `(park.latitude BETWEEN :latMin AND :latMax 
           AND park.longitude BETWEEN :lngMin AND :lngMax 
           AND park.timezone = :timezone)
           OR (wd.latitude BETWEEN :latMin AND :latMax 
           AND wd.longitude BETWEEN :lngMin AND :lngMax 
           AND wd.timezone = :timezone)`,
          {
            latMin: key.latitude - 0.001, // Small tolerance for coordinate matching
            latMax: key.latitude + 0.001,
            lngMin: key.longitude - 0.001,
            lngMax: key.longitude + 0.001,
            timezone: key.timezone,
          },
        )
        .getOne();

      if (!weatherEntry) {
        this.logger.debug(
          `Database cache miss for coordinates: ${key.latitude},${key.longitude} on ${key.date}`,
        );
        return null;
      }

      // Check if entry has expired
      if (new Date() > weatherEntry.validUntil) {
        this.logger.debug(
          `Database cache entry expired for weather data ID: ${weatherEntry.id}`,
        );
        await this.weatherDataRepository.delete({ id: weatherEntry.id });
        return null;
      }

      // Check if it's a failed fetch entry
      if (weatherEntry.isFetchFailed) {
        this.logger.debug(
          `Database cache entry marked as failed fetch for ID: ${weatherEntry.id}`,
        );
        return null;
      }

      this.logger.debug(
        `Database cache hit for weather data ID: ${weatherEntry.id}`,
      );

      // Convert database entry back to WeatherData format
      const weatherData: WeatherData = {
        temperature: {
          min: weatherEntry.temperatureMin,
          max: weatherEntry.temperatureMax,
        },
        precipitationProbability: weatherEntry.precipitationProbability,
        weatherCode: weatherEntry.weatherCode,
        status: weatherEntry.status,
        weatherScore: weatherEntry.weatherScore,
      };

      return weatherData;
    } catch (error) {
      this.logger.error(
        `Error retrieving weather cache for coordinates ${key.latitude},${key.longitude}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Set weather data in database cache with TTL
   */
  async set(
    key: WeatherCacheKey,
    data: WeatherData | null,
    ttlHours: number = 12,
  ): Promise<void> {
    const now = new Date();
    const validUntil = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
    const weatherId = this.getCoordinateWeatherDataId(
      key.latitude,
      key.longitude,
      key.date,
      WeatherDataType.CURRENT,
    );

    try {
      // Check if entry already exists and update it, or create new one
      let existingEntry = await this.weatherDataRepository.findOne({
        where: { id: weatherId },
      });

      if (data === null) {
        // Store or update failed fetch attempt
        if (existingEntry) {
          existingEntry.isFetchFailed = true;
          existingEntry.validUntil = validUntil;
          existingEntry.updatedAt = now;
        } else {
          existingEntry = this.weatherDataRepository.create({
            id: weatherId,
            latitude: key.latitude,
            longitude: key.longitude,
            timezone: key.timezone,
            weatherDate: new Date(key.date),
            dataType: WeatherDataType.CURRENT,
            temperatureMin: 0,
            temperatureMax: 0,
            precipitationProbability: 0,
            weatherCode: 0,
            status: 'cloudy' as any,
            weatherScore: 0,
            validUntil,
            isFetchFailed: true,
          });
        }

        await this.weatherDataRepository.save(existingEntry);
        this.logger.debug(
          `Cached failed weather fetch for coordinates: ${key.latitude},${key.longitude}, expires at: ${validUntil.toISOString()}`,
        );
        return;
      }

      // Store or update successful weather data
      if (existingEntry) {
        // Update existing entry
        existingEntry.latitude = key.latitude;
        existingEntry.longitude = key.longitude;
        existingEntry.timezone = key.timezone;
        existingEntry.temperatureMin = data.temperature.min;
        existingEntry.temperatureMax = data.temperature.max;
        existingEntry.precipitationProbability = data.precipitationProbability;
        existingEntry.weatherCode = data.weatherCode;
        existingEntry.status = data.status;
        existingEntry.weatherScore = data.weatherScore;
        existingEntry.validUntil = validUntil;
        existingEntry.isFetchFailed = false;
        existingEntry.updatedAt = now;
      } else {
        // Create new entry
        existingEntry = this.weatherDataRepository.create({
          id: weatherId,
          latitude: key.latitude,
          longitude: key.longitude,
          timezone: key.timezone,
          weatherDate: new Date(key.date),
          dataType: WeatherDataType.CURRENT,
          temperatureMin: data.temperature.min,
          temperatureMax: data.temperature.max,
          precipitationProbability: data.precipitationProbability,
          weatherCode: data.weatherCode,
          status: data.status,
          weatherScore: data.weatherScore,
          validUntil,
          isFetchFailed: false,
        });
      }

      await this.weatherDataRepository.save(existingEntry);
      this.logger.debug(
        `Cached weather data in database for coordinates: ${key.latitude},${key.longitude}, expires at: ${validUntil.toISOString()}`,
      );
    } catch (error) {
      this.logger.error(
        `Error saving weather cache for coordinates ${key.latitude},${key.longitude}:`,
        error,
      );
    }
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
          latitude: 0, // Will be populated by park relation
          longitude: 0, // Will be populated by park relation
          timezone: '', // Will be populated by park relation
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
   * Get all unique park locations that need weather updates for today
   */
  async getLocationsForUpdate(date?: Date): Promise<
    Array<{
      parkId?: number;
      latitude: number;
      longitude: number;
      timezone: string;
    }>
  > {
    const targetDate = date || new Date();
    const dateString = targetDate.toISOString().split('T')[0];

    try {
      // First check if weather_data table exists by trying to count entries
      try {
        await this.weatherDataRepository.count();
      } catch (tableError) {
        // If table doesn't exist yet, return all parks
        this.logger.debug(
          'Weather data table not yet created, returning all active parks',
        );
        const result = await this.weatherDataRepository.query(`
          SELECT 
            p.id as park_id,
            p.latitude, 
            p.longitude, 
            p.timezone
          FROM park p
        `);

        return result.map((row) => ({
          parkId: row.park_id ? parseInt(row.park_id) : undefined,
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude),
          timezone: row.timezone,
        }));
      }

      // Get all parks that don't have valid current weather data for today
      const result = await this.weatherDataRepository.query(
        `
        SELECT DISTINCT 
          p.id as park_id,
          p.latitude, 
          p.longitude, 
          p.timezone
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

      return result.map((row) => ({
        parkId: row.park_id ? parseInt(row.park_id) : undefined,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        timezone: row.timezone,
      }));
    } catch (error) {
      this.logger.error('Error getting locations for weather update:', error);
      // Fallback: return all active parks
      try {
        const fallbackResult = await this.weatherDataRepository.query(`
          SELECT 
            p.id as park_id,
            p.latitude, 
            p.longitude, 
            p.timezone
          FROM park p
          LIMIT 50
        `);

        return fallbackResult.map((row) => ({
          parkId: row.park_id ? parseInt(row.park_id) : undefined,
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude),
          timezone: row.timezone,
        }));
      } catch (fallbackError) {
        this.logger.error('Fallback query also failed:', fallbackError);
        return [];
      }
    }
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
