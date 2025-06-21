import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Park } from './park.entity.js';
import { ParkQueryDto } from './parks.dto.js';
import { CrowdLevelService } from './crowd-level.service.js';
import { WeatherService } from './weather.service.js';
import { ParkUtilsService } from '../utils/park-utils.service.js';
import {
  ParkOperatingStatus,
  WaitTimeDistribution,
} from '../utils/park-utils.types.js';

@Injectable()
export class ParksService {
  private readonly logger = new Logger(ParksService.name);

  constructor(
    @InjectRepository(Park)
    private readonly parkRepository: Repository<Park>,
    private readonly parkUtils: ParkUtilsService,
    private readonly crowdLevelService: CrowdLevelService,
    private readonly weatherService: WeatherService,
  ) {}

  /**
   * Get the default park open threshold from configuration
   * @private
   */
  private getDefaultOpenThreshold(): number {
    return this.parkUtils.getDefaultOpenThreshold();
  }

  /**
   * Helper function to extract current queue time from a ride
   * @private
   */
  private getCurrentQueueTime(ride: any) {
    return this.parkUtils.getCurrentQueueTime(ride);
  }

  /**
   * Helper function to calculate if a park is open based on the percentage of open rides
   * @private
   */
  private calculateParkOpenStatus(
    park: any,
    openThreshold?: number,
  ): ParkOperatingStatus {
    return this.parkUtils.getDetailedParkOpenStatus(park, openThreshold);
  }

  /**
   * Helper function to calculate wait time distribution for a park
   * @private
   */
  private calculateWaitTimeDistribution(park: any): WaitTimeDistribution {
    return this.parkUtils.calculateWaitTimeDistribution(park);
  }

  /**
   * Helper function to transform rides with current queue times
   */
  private transformRide(ride: any) {
    return {
      ...ride,
      currentQueueTime: this.getCurrentQueueTime(ride),
      queueTimes: undefined, // Remove the full queueTimes array from response
      themeArea: undefined, // Remove theme area reference to avoid circular data
      park: undefined, // Remove park reference to avoid circular data
    };
  }

  /**
   * Helper function to transform theme areas with rides
   */
  private transformThemeArea(themeArea: any) {
    return {
      ...themeArea,
      rides: themeArea.rides.map((ride) => this.transformRide(ride)),
      park: undefined, // Remove park reference to avoid circular data
    };
  }

  /**
   * Helper function to transform parks with theme areas and rides
   */
  private async transformPark(
    park: any,
    openThreshold?: number,
    includeCrowdLevel: boolean = true,
    includeWeather: boolean = true,
  ) {
    const openStatus = this.calculateParkOpenStatus(park, openThreshold);
    const waitTimeDistribution = this.calculateWaitTimeDistribution(park);

    // Get cached weather data only - never make API calls during request processing
    let weather = null;
    if (includeWeather) {
      try {
        // Use the cache-only method to avoid API calls during request processing
        weather = await this.weatherService.getCachedWeatherForLocation(
          park.latitude,
          park.longitude,
          park.timezone,
        );
      } catch (error) {
        this.logger.debug(
          `Error getting cached weather data for park ${park.id}: ${error.message}`,
        );
        // Don't throw error, just continue without weather data
      }
    }

    // Handle parks with and without theme areas
    let themeAreas = park.themeAreas.map((themeArea) =>
      this.transformThemeArea(themeArea),
    );

    // If park has no theme areas but has direct rides, create a virtual theme area
    if (themeAreas.length === 0 && park.rides && park.rides.length > 0) {
      // Filter rides that are not already assigned to a theme area
      const unassignedRides = park.rides.filter((ride) => !ride.themeArea);

      if (unassignedRides.length > 0) {
        themeAreas = [
          {
            id: null,
            queueTimesId: null,
            name: 'Rides', // Generic name for rides without theme area
            rides: unassignedRides.map((ride) => this.transformRide(ride)),
          },
        ];
      }
    }

    // Create result object by copying specific properties to avoid any unwanted data
    const result: any = {
      id: park.id,
      queueTimesId: park.queueTimesId,
      name: park.name,
      country: park.country,
      continent: park.continent,
      latitude: park.latitude,
      longitude: park.longitude,
      timezone: park.timezone,
      parkGroup: park.parkGroup,
      themeAreas: themeAreas,
      operatingStatus: openStatus,
      waitTimeDistribution, // Add wait time distribution to park data
    };

    // Add weather data only if requested and available
    if (includeWeather && weather) {
      result.weather = weather;
    }

    // Only calculate and include crowd level if requested
    if (includeCrowdLevel) {
      try {
        result.crowdLevel =
          await this.crowdLevelService.calculateCrowdLevelWithTimeout(
            park,
            2000,
          );
      } catch (error) {
        this.logger.warn(
          `Failed to calculate crowd level for park ${park.id}:`,
          error,
        );
        // Add default crowd level on error
        result.crowdLevel = {
          level: 0,
          label: 'Very Low',
          ridesUsed: 0,
          totalRides: 0,
          historicalBaseline: 0,
          currentAverage: 0,
          confidence: 0,
          calculatedAt: new Date(),
        };
      }
    }

    return result;
  }

  /**
   * Optimized version of transformPark that uses pre-fetched weather data
   */
  async transformParkWithWeatherData(
    park: any,
    weatherDataMap: Map<string, any>,
    openThreshold?: number,
    includeCrowdLevel: boolean = true,
    includeWeather: boolean = true,
  ) {
    const openStatus = this.calculateParkOpenStatus(park, openThreshold);
    const waitTimeDistribution = this.calculateWaitTimeDistribution(park);

    // Get pre-fetched weather data from map
    let weather = null;
    if (includeWeather && weatherDataMap.size > 0) {
      const latNum =
        typeof park.latitude === 'number'
          ? park.latitude
          : parseFloat(String(park.latitude));
      const lngNum =
        typeof park.longitude === 'number'
          ? park.longitude
          : parseFloat(String(park.longitude));
      const weatherKey = `${latNum},${lngNum}`;
      weather = weatherDataMap.get(weatherKey) || null;
    }

    // Handle parks with and without theme areas
    let themeAreas = park.themeAreas.map((themeArea) =>
      this.transformThemeArea(themeArea),
    );

    // If park has no theme areas but has direct rides, create a virtual theme area
    if (themeAreas.length === 0 && park.rides && park.rides.length > 0) {
      // Filter rides that are not already assigned to a theme area
      const unassignedRides = park.rides.filter((ride) => !ride.themeArea);

      if (unassignedRides.length > 0) {
        themeAreas = [
          {
            id: null,
            queueTimesId: null,
            name: 'Rides', // Generic name for rides without theme area
            rides: unassignedRides.map((ride) => this.transformRide(ride)),
          },
        ];
      }
    }

    // Create result object by copying specific properties to avoid any unwanted data
    const result: any = {
      id: park.id,
      queueTimesId: park.queueTimesId,
      name: park.name,
      country: park.country,
      continent: park.continent,
      latitude: park.latitude,
      longitude: park.longitude,
      timezone: park.timezone,
      parkGroup: park.parkGroup,
      themeAreas: themeAreas,
      operatingStatus: openStatus,
      waitTimeDistribution, // Add wait time distribution to park data
    };

    // Add weather data only if requested and available
    if (includeWeather && weather) {
      result.weather = weather;
    }

    // Only calculate and include crowd level if requested
    if (includeCrowdLevel) {
      try {
        result.crowdLevel =
          await this.crowdLevelService.calculateCrowdLevelWithTimeout(
            park,
            2000,
          );
      } catch (error) {
        this.logger.warn(
          `Failed to calculate crowd level for park ${park.id}:`,
          error,
        );
        // Add default crowd level on error
        result.crowdLevel = {
          level: 0,
          label: 'Very Low',
          ridesUsed: 0,
          totalRides: 0,
          historicalBaseline: 0,
          currentAverage: 0,
          confidence: 0,
          calculatedAt: new Date(),
        };
      }
    }

    return result;
  }

  /**
   * Get all parks with optional filtering and pagination
   */
  async findAll(query: ParkQueryDto = {}): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const {
      search,
      country,
      continent,
      parkGroupId,
      page = 1,
      limit = 10,
      openThreshold,
      includeCrowdLevel = true,
      includeWeather = true,
    } = query;

    const threshold = openThreshold ?? this.getDefaultOpenThreshold();
    const queryBuilder = this.parkRepository
      .createQueryBuilder('park')
      .leftJoinAndSelect('park.parkGroup', 'parkGroup')
      .leftJoinAndSelect('park.themeAreas', 'themeAreas')
      .leftJoinAndSelect('themeAreas.rides', 'themeAreaRides')
      .leftJoinAndSelect('park.rides', 'rides')
      .leftJoinAndSelect(
        'themeAreaRides.queueTimes',
        'themeAreaQueueTimes',
        'themeAreaQueueTimes.lastUpdated = (SELECT MAX(qt."lastUpdated") FROM queue_time qt WHERE qt."rideId" = themeAreaRides.id)',
      )
      .leftJoinAndSelect(
        'rides.queueTimes',
        'rideQueueTimes',
        'rideQueueTimes.lastUpdated = (SELECT MAX(qt."lastUpdated") FROM queue_time qt WHERE qt."rideId" = rides.id)',
      );

    // Apply filters
    if (search) {
      queryBuilder.andWhere(
        '(LOWER(park.name) LIKE LOWER(:search) OR LOWER(park.country) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    if (country) {
      queryBuilder.andWhere('LOWER(park.country) = LOWER(:country)', {
        country,
      });
    }

    if (continent) {
      queryBuilder.andWhere('LOWER(park.continent) = LOWER(:continent)', {
        continent,
      });
    }

    if (parkGroupId) {
      queryBuilder.andWhere('park.parkGroup.id = :parkGroupId', {
        parkGroupId,
      });
    } // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Order by name
    queryBuilder.orderBy('park.name', 'ASC');

    // Get total count for pagination
    const totalCount = await queryBuilder.getCount();
    const parks = await queryBuilder.getMany();

    // Optimize weather data retrieval for multiple parks
    let weatherDataMap = new Map<string, any>();
    if (includeWeather && parks.length > 0) {
      try {
        // Get all weather data in one batch call instead of individual calls
        const locations = parks.map((park) => ({
          latitude: park.latitude,
          longitude: park.longitude,
          timezone: park.timezone,
          id: park.id,
        }));

        weatherDataMap =
          await this.weatherService.getBatchCachedWeatherForLocations(
            locations,
          );
      } catch (error) {
        this.logger.warn('Error retrieving batch weather data:', error);
        // Continue without weather data if batch fails
      }
    }

    // Transform the data using helper functions
    const transformedParks = await Promise.all(
      parks.map((park) =>
        this.transformParkWithWeatherData(
          park,
          weatherDataMap,
          threshold,
          includeCrowdLevel,
          includeWeather,
        ),
      ),
    );

    return {
      data: transformedParks,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
    };
  }
  /**
   * Get a single park by ID
   */
  async findOne(
    id: number,
    openThreshold?: number,
    includeCrowdLevel: boolean = true,
    includeWeather: boolean = true,
  ): Promise<any> {
    const park = await this.parkRepository
      .createQueryBuilder('park')
      .leftJoinAndSelect('park.parkGroup', 'parkGroup')
      .leftJoinAndSelect('park.themeAreas', 'themeAreas')
      .leftJoinAndSelect('themeAreas.rides', 'themeAreaRides')
      .leftJoinAndSelect('park.rides', 'rides')
      .leftJoinAndSelect(
        'themeAreaRides.queueTimes',
        'themeAreaQueueTimes',
        'themeAreaQueueTimes.lastUpdated = (SELECT MAX(qt."lastUpdated") FROM queue_time qt WHERE qt."rideId" = themeAreaRides.id)',
      )
      .leftJoinAndSelect(
        'rides.queueTimes',
        'rideQueueTimes',
        'rideQueueTimes.lastUpdated = (SELECT MAX(qt."lastUpdated") FROM queue_time qt WHERE qt."rideId" = rides.id)',
      )
      .where('park.id = :id', { id })
      .getOne();
    if (!park) {
      throw new NotFoundException(`Park with ID ${id} not found`);
    }

    // For single park, we can still use the optimized method with a single-item map
    let weatherDataMap = new Map<string, any>();
    if (includeWeather) {
      try {
        const locations = [
          {
            latitude: park.latitude,
            longitude: park.longitude,
            timezone: park.timezone,
            id: park.id,
          },
        ];

        weatherDataMap =
          await this.weatherService.getBatchCachedWeatherForLocations(
            locations,
          );
      } catch (error) {
        this.logger.warn(
          'Error retrieving weather data for single park:',
          error,
        );
        // Continue without weather data if fails
      }
    }

    // Transform the data using helper functions
    return await this.transformParkWithWeatherData(
      park,
      weatherDataMap,
      openThreshold,
      includeCrowdLevel,
      includeWeather,
    );
  }

  /**
   * Get a park by queueTimesId
   */
  async findByQueueTimesId(queueTimesId: number): Promise<Park> {
    const park = await this.parkRepository.findOne({
      where: { queueTimesId },
      relations: {
        parkGroup: true,
        themeAreas: {
          rides: true,
        },
      },
    });

    if (!park) {
      throw new NotFoundException(
        `Park with queueTimesId ${queueTimesId} not found`,
      );
    }
    return park;
  }

  /**
   * Get all rides for a specific park
   */
  async findParkRides(parkId: number): Promise<{
    parkId: number;
    parkName: string;
    rides: any[];
  }> {
    const park = await this.parkRepository.findOne({
      where: { id: parkId },
      relations: {
        themeAreas: {
          rides: {
            queueTimes: true,
          },
        },
        rides: {
          queueTimes: true,
        },
      },
    });

    if (!park) {
      throw new NotFoundException(`Park with ID ${parkId} not found`);
    }

    // Get all rides from theme areas
    const themeAreaRides = park.themeAreas.flatMap((themeArea) =>
      themeArea.rides.map((ride) => ({
        id: ride.id,
        name: ride.name,
        isActive: ride.isActive,
        themeArea: {
          id: themeArea.id,
          name: themeArea.name,
        },
        currentQueueTime: this.getCurrentQueueTime(ride),
      })),
    );

    // Get direct park rides (if any)
    const directParkRides = (park.rides || []).map((ride) => ({
      id: ride.id,
      name: ride.name,
      isActive: ride.isActive,
      themeArea: null, // Direct park rides don't belong to a theme area
      currentQueueTime: this.getCurrentQueueTime(ride),
    }));

    // Combine all rides, avoiding duplicates
    const allRidesMap = new Map();
    themeAreaRides.forEach((ride) => allRidesMap.set(ride.id, ride));
    directParkRides.forEach((ride) => allRidesMap.set(ride.id, ride));
    const allRides = Array.from(allRidesMap.values());

    return {
      parkId: park.id,
      parkName: park.name,
      rides: allRides,
    };
  }

  /**
   * Find park by continent, country, and park name using database query
   * This is much more efficient than loading all parks and filtering
   */
  async findParkByHierarchy(
    continentSlug: string,
    countrySlug: string,
    parkSlug: string,
  ): Promise<any | null> {
    // Convert slugs to possible name variations
    const continentVariations = this.generateNameVariations(continentSlug);
    const countryVariations = this.generateNameVariations(countrySlug);
    const parkVariations = this.generateNameVariations(parkSlug);

    const queryBuilder = this.parkRepository
      .createQueryBuilder('park')
      .leftJoinAndSelect('park.parkGroup', 'parkGroup')
      .leftJoinAndSelect('park.themeAreas', 'themeAreas')
      .leftJoinAndSelect('themeAreas.rides', 'themeAreaRides')
      .leftJoinAndSelect('park.rides', 'rides')
      .leftJoinAndSelect('themeAreaRides.queueTimes', 'themeAreaQueueTimes')
      .leftJoinAndSelect('rides.queueTimes', 'rideQueueTimes');

    // Add conditions for continent, country, and park name
    queryBuilder.where(
      'LOWER(park.continent) IN (:...continents) AND LOWER(park.country) IN (:...countries) AND LOWER(park.name) IN (:...parks)',
      {
        continents: continentVariations.map((v) => v.toLowerCase()),
        countries: countryVariations.map((v) => v.toLowerCase()),
        parks: parkVariations.map((v) => v.toLowerCase()),
      },
    );

    const park = await queryBuilder.getOne();
    return park;
  }

  /**
   * Find ride by park ID and ride name using database query
   */
  async findRideByParkAndName(
    parkId: number,
    rideSlug: string,
  ): Promise<any | null> {
    const rideVariations = this.generateNameVariations(rideSlug);

    // Query rides from both theme areas and direct park rides
    const park = await this.parkRepository
      .createQueryBuilder('park')
      .leftJoinAndSelect('park.themeAreas', 'themeAreas')
      .leftJoinAndSelect('themeAreas.rides', 'themeAreaRides')
      .leftJoinAndSelect('park.rides', 'rides')
      .leftJoinAndSelect('themeAreaRides.queueTimes', 'themeAreaQueueTimes')
      .leftJoinAndSelect('rides.queueTimes', 'rideQueueTimes')
      .where('park.id = :parkId', { parkId })
      .andWhere(
        '(LOWER(themeAreaRides.name) IN (:...rideNames) OR LOWER(rides.name) IN (:...rideNames))',
        {
          rideNames: rideVariations.map((v) => v.toLowerCase()),
        },
      )
      .getOne();

    if (!park) {
      return null;
    }

    // Find the matching ride from theme areas or direct rides
    for (const themeArea of park.themeAreas) {
      for (const ride of themeArea.rides) {
        if (
          rideVariations.some(
            (variation) => variation.toLowerCase() === ride.name.toLowerCase(),
          )
        ) {
          return {
            ...this.transformRideWithLatestQueueTime(ride),
            themeArea: {
              id: themeArea.id,
              name: themeArea.name,
            },
          };
        }
      }
    }

    for (const ride of park.rides) {
      if (
        rideVariations.some(
          (variation) => variation.toLowerCase() === ride.name.toLowerCase(),
        )
      ) {
        return {
          ...this.transformRideWithLatestQueueTime(ride),
          themeArea: null,
        };
      }
    }

    return null;
  }

  /**
   * Generate name variations from slug for database matching
   */
  private generateNameVariations(slug: string): string[] {
    const variations = new Set<string>();

    // Add original slug
    variations.add(slug);

    // Add with spaces instead of hyphens
    variations.add(slug.replace(/-/g, ' '));

    // Add with underscores instead of hyphens
    variations.add(slug.replace(/-/g, '_'));

    // Add title case version
    const titleCase = slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
    variations.add(titleCase);

    // Add all lowercase
    variations.add(slug.toLowerCase());

    // Add all uppercase
    variations.add(slug.toUpperCase());

    return Array.from(variations);
  }

  /**
   * Get the latest queue time from an array of queue times
   */
  private getLatestQueueTime(queueTimes: any[]): any | null {
    if (!queueTimes || queueTimes.length === 0) {
      return null;
    }

    return queueTimes.reduce((latest, current) => {
      if (!latest) return current;
      return new Date(current.lastUpdated) > new Date(latest.lastUpdated)
        ? current
        : latest;
    }, null);
  }

  /**
   * Transform ride data with latest queue time
   */
  private transformRideWithLatestQueueTime(ride: any): any {
    const latestQueueTime = this.getLatestQueueTime(ride.queueTimes);

    return {
      id: ride.id,
      queueTimesId: ride.queueTimesId,
      name: ride.name,
      isActive: ride.isActive,
      queueTime: latestQueueTime
        ? {
            id: latestQueueTime.id,
            waitTime: latestQueueTime.waitTime,
            isOpen: latestQueueTime.isOpen,
            lastUpdated: latestQueueTime.lastUpdated,
          }
        : null,
    };
  }
}
