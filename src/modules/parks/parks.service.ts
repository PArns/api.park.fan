import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Park } from './park.entity.js';
import { ParkQueryDto } from './parks.dto.js';
import { CrowdLevelService } from './crowd-level.service.js';
import { WeatherService } from './weather.service.js';
import { ParkUtilsService } from '../utils/park-utils.service.js';
import { CacheService } from '../utils/cache.service.js';
import { RidesService } from '../rides/rides.service.js';

@Injectable()
export class ParksService {
  private readonly logger = new Logger(ParksService.name);

  constructor(
    @InjectRepository(Park)
    private readonly parkRepository: Repository<Park>,
    private readonly parkUtils: ParkUtilsService,
    private readonly crowdLevelService: CrowdLevelService,
    private readonly weatherService: WeatherService,
    private readonly cacheService: CacheService,
    private readonly ridesService: RidesService,
  ) {}

  /**
   * Get the default park open threshold from configuration
   * @private
   */
  private getDefaultOpenThreshold(): number {
    return this.parkUtils.getDefaultOpenThreshold();
  }

  /**
   * Get all distinct continents efficiently using query builder
   */
  async getDistinctContinents(): Promise<string[]> {
    const result = await this.parkRepository
      .createQueryBuilder('park')
      .select('DISTINCT park.continent', 'continent')
      .where('park.continent IS NOT NULL')
      .getRawMany();

    const continents = result.map((row) => row.continent).filter(Boolean);

    return continents;
  }

  /**
   * Get all distinct countries efficiently using query builder
   */
  async getDistinctCountries(continent?: string): Promise<string[]> {
    const queryBuilder = this.parkRepository
      .createQueryBuilder('park')
      .select('DISTINCT park.country', 'country')
      .where('park.country IS NOT NULL');

    if (continent) {
      queryBuilder.andWhere('park.continent = :continent', { continent });
    }

    const result = await queryBuilder.getRawMany();
    const countries = result.map((row) => row.country).filter(Boolean);

    return countries;
  }

  /**
   * Helper function to transform rides with current queue times using queue time map
   */
  private transformRide(ride: any, queueTimeMap: Map<number, any>) {
    const currentQueueTime = queueTimeMap.get(ride.id) || null;

    return {
      ...ride,
      currentQueueTime,
      queueTimes: undefined, // Remove the full queueTimes array from response
      themeArea: undefined, // Remove theme area reference to avoid circular data
      park: undefined, // Remove park reference to avoid circular data
    };
  }  /**
   * Helper function to transform theme areas with rides using queue time map
   */
  private transformThemeArea(themeArea: any, queueTimeMap: Map<number, any>) {
    const rides = themeArea.rides.map((ride) => this.transformRide(ride, queueTimeMap));

    return {
      ...themeArea,
      rides,
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
    const openStatus = await this.parkUtils.getDetailedParkOpenStatusFromDb(
      park.id,
      openThreshold,
    );
    const waitTimeDistribution =
      await this.parkUtils.calculateWaitTimeDistributionFromDb(park.id);

    // Create queueTimeMap from already loaded queueTimes
    const queueTimeMap = new Map();
    const allRides = [
      ...(park.rides || []),
      ...(park.themeAreas || []).flatMap(ta => ta.rides || [])
    ];
    
    allRides.forEach((ride) => {
      if (ride.queueTimes && ride.queueTimes.length > 0) {
        queueTimeMap.set(ride.id, ride.queueTimes[0]);
      }
    });

    // Get cached weather data for park (current + forecast) - never make API calls during request processing
    let weatherData = null;
    if (includeWeather) {
      try {
        // Use park-specific weather method that includes current weather and forecast
        weatherData = await this.weatherService.getCompleteWeatherForPark(
          park.id,
        );
      } catch (error) {
        this.logger.debug(
          `Error getting cached weather data for park ${park.id}: ${error.message}`,
        );
        // Don't throw error, just continue without weather data
      }
    }

    // Handle parks with and without theme areas
    let themeAreas = park.themeAreas.map((themeArea) => this.transformThemeArea(themeArea, queueTimeMap));

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
            rides: unassignedRides.map((ride) => this.transformRide(ride, queueTimeMap)),
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
    if (
      includeWeather &&
      weatherData &&
      (weatherData.current || weatherData.forecast.length > 0)
    ) {
      result.weather = {
        current: weatherData.current,
        forecast: weatherData.forecast,
      };
    }

    // Only calculate and include crowd level if requested
    if (includeCrowdLevel) {
      try {
        result.crowdLevel =
          await this.crowdLevelService.calculateCrowdLevel(park);
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
    weatherDataMap: Map<number, any>, // Changed from coordinate-based to park-ID-based Map
    openThreshold?: number,
    includeCrowdLevel: boolean = true,
    includeWeather: boolean = true,
  ) {
    const openStatus = await this.parkUtils.getDetailedParkOpenStatusFromDb(
      park.id,
      openThreshold,
    );
    const waitTimeDistribution =
      await this.parkUtils.calculateWaitTimeDistributionFromDb(park.id);

    // Get pre-fetched weather data from map using park ID
    let weatherData = null;
    if (includeWeather && weatherDataMap.size > 0) {
      weatherData = weatherDataMap.get(park.id) || null;
    }

    // Create queueTimeMap from already loaded queueTimes
    const queueTimeMap = new Map();
    const allRides = [
      ...(park.rides || []),
      ...(park.themeAreas || []).flatMap(ta => ta.rides || [])
    ];
    
    allRides.forEach((ride) => {
      if (ride.queueTimes && ride.queueTimes.length > 0) {
        queueTimeMap.set(ride.id, ride.queueTimes[0]);
      }
    });

    // Handle parks with and without theme areas
    let themeAreas = park.themeAreas.map((themeArea) => this.transformThemeArea(themeArea, queueTimeMap));

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
            rides: unassignedRides.map((ride) => this.transformRide(ride, queueTimeMap)),
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
    if (
      includeWeather &&
      weatherData &&
      (weatherData.current || weatherData.forecast.length > 0)
    ) {
      result.weather = {
        current: weatherData.current,
        forecast: weatherData.forecast,
      };
    }

    // Only calculate and include crowd level if requested
    if (includeCrowdLevel) {
      try {
        result.crowdLevel =
          await this.crowdLevelService.calculateCrowdLevel(park);
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
   * Get all parks with optional filtering and pagination - Optimized version
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

    // Create cache key for the entire request
    const cacheKey = `parks:findAll:${JSON.stringify({
      search,
      country,
      continent,
      parkGroupId,
      page,
      limit,
      threshold,
      includeCrowdLevel,
      includeWeather,
    })}`;

    // Check cache first
    const cached = this.cacheService.get<{
      data: any[];
      pagination: {
        page: number;
        limit: number;
        totalCount: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    // Build count query separately for better performance
    const countQueryBuilder = this.parkRepository.createQueryBuilder('park');

    // Apply filters to count query
    if (search) {
      countQueryBuilder.andWhere(
        '(park.name ILIKE :search OR park.country ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (country) {
      countQueryBuilder.andWhere('park.country = :country', { country });
    }
    if (continent) {
      countQueryBuilder.andWhere('park.continent = :continent', { continent });
    }
    if (parkGroupId) {
      countQueryBuilder.andWhere('park.parkGroup.id = :parkGroupId', {
        parkGroupId,
      });
    }

    // Get total count
    const totalCount = await countQueryBuilder.getCount();

    if (totalCount === 0) {
      const emptyResult = {
        data: [],
        pagination: {
          page,
          limit,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
      this.cacheService.set(cacheKey, emptyResult); // Use default TTL
      return emptyResult;
    }

    // Optimized main query using raw SQL for better performance
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(
        `(p.name ILIKE $${paramIndex} OR p.country ILIKE $${paramIndex})`,
      );
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    if (country) {
      whereConditions.push(`p.country = $${paramIndex}`);
      queryParams.push(country);
      paramIndex++;
    }
    if (continent) {
      whereConditions.push(`p.continent = $${paramIndex}`);
      queryParams.push(continent);
      paramIndex++;
    }
    if (parkGroupId) {
      whereConditions.push(`p."parkGroupId" = $${paramIndex}`);
      queryParams.push(parkGroupId);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    // Add pagination parameters
    queryParams.push(limit, offset);
    const limitParam = paramIndex;
    const offsetParam = paramIndex + 1;

    // Single optimized query with proper pagination - first get the parks, then join all data
    const parksQuery = `
      WITH paginated_parks AS (
        SELECT p.id
        FROM park p
        ${whereClause}
        ORDER BY p.name ASC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      )
      SELECT 
        p.id as park_id,
        p."queueTimesId" as park_queue_times_id,
        p.name as park_name,
        p.country as park_country,
        p.continent as park_continent,
        p.latitude as park_latitude,
        p.longitude as park_longitude,
        p.timezone as park_timezone,
        pg.id as park_group_id,
        pg.name as park_group_name,
        pg."queueTimesId" as park_group_queue_times_id,
        ta.id as theme_area_id,
        ta."queueTimesId" as theme_area_queue_times_id,
        ta.name as theme_area_name,
        r.id as ride_id,
        r."queueTimesId" as ride_queue_times_id,
        r.name as ride_name,
        r."isActive" as ride_is_active,
        r."themeAreaId" as ride_theme_area_id,
        r."parkId" as ride_park_id
      FROM paginated_parks pp
      JOIN park p ON p.id = pp.id
      LEFT JOIN park_group pg ON p."parkGroupId" = pg.id
      LEFT JOIN theme_area ta ON ta."parkId" = p.id
      LEFT JOIN ride r ON (r."themeAreaId" = ta.id OR r."parkId" = p.id)
      ORDER BY p.name ASC, ta.name ASC, r.name ASC
    `;

    const rawResults = await this.parkRepository.query(parksQuery, queryParams);

    // Transform raw results into structured park data
    const parksMap = new Map();

    rawResults.forEach((row: any) => {
      const parkId = row.park_id;

      if (!parksMap.has(parkId)) {
        parksMap.set(parkId, {
          id: parkId,
          queueTimesId: row.park_queue_times_id,
          name: row.park_name,
          country: row.park_country,
          continent: row.park_continent,
          latitude: row.park_latitude,
          longitude: row.park_longitude,
          timezone: row.park_timezone,
          parkGroup: row.park_group_id
            ? {
                id: row.park_group_id,
                name: row.park_group_name,
                queueTimesId: row.park_group_queue_times_id,
              }
            : null,
          themeAreas: new Map(),
          rides: new Map(),
          allRideIds: new Set(), // Collect all ride IDs for batch queue time loading
        });
      }

      const park = parksMap.get(parkId);

      // Handle theme areas and rides
      if (row.ride_id) {
        const ride = {
          id: row.ride_id,
          queueTimesId: row.ride_queue_times_id,
          name: row.ride_name,
          isActive: row.ride_is_active,
          queueTimes: [], // Will be populated separately
        };

        // Add ride ID to the set for batch loading
        park.allRideIds.add(row.ride_id);

        if (row.ride_theme_area_id && row.theme_area_id) {
          // Ride belongs to a theme area
          if (!park.themeAreas.has(row.theme_area_id)) {
            park.themeAreas.set(row.theme_area_id, {
              id: row.theme_area_id,
              queueTimesId: row.theme_area_queue_times_id,
              name: row.theme_area_name,
              rides: [],
            });
          }
          park.themeAreas.get(row.theme_area_id).rides.push(ride);
        } else if (row.ride_park_id === parkId) {
          // Direct park ride
          park.rides.set(row.ride_id, ride);
        }
      } else if (row.theme_area_id && !park.themeAreas.has(row.theme_area_id)) {
        // Theme area without rides
        park.themeAreas.set(row.theme_area_id, {
          id: row.theme_area_id,
          queueTimesId: row.theme_area_queue_times_id,
          name: row.theme_area_name,
          rides: [],
        });
      }
    });

    // Batch load latest queue times for all rides
    const allRideIds = Array.from(
      new Set(
        Array.from(parksMap.values()).flatMap((park) =>
          Array.from(park.allRideIds),
        ),
      ),
    );

    let queueTimeMap = new Map();
    if (allRideIds.length > 0) {
      // Use optimized query to get ONLY the latest queue time for each ride
      const latestQueueTimes = await this.parkRepository.query(
        `
        SELECT DISTINCT ON (qt."rideId") 
          qt."rideId",
          qt.id as queue_time_id,
          qt."waitTime",
          qt."isOpen",
          qt."lastUpdated",
          qt."recordedAt"
        FROM queue_time qt
        WHERE qt."rideId" = ANY($1)
        ORDER BY qt."rideId", qt."lastUpdated" DESC, qt."recordedAt" DESC
      `,
        [allRideIds],
      );

      // Create lookup map
      latestQueueTimes.forEach((qt) => {
        queueTimeMap.set(qt.rideId, [
          {
            id: qt.queue_time_id,
            waitTime: qt.waitTime,
            isOpen: qt.isOpen,
            lastUpdated: qt.lastUpdated,
            recordedAt: qt.recordedAt,
          },
        ]);
      });
    }

    // Convert Maps to Arrays and apply queue times to rides
    const parks = Array.from(parksMap.values()).map((park) => {
      // Apply queue times to theme area rides
      const themeAreas = Array.from(park.themeAreas.values()).map(
        (themeArea: any) => ({
          ...themeArea,
          rides: themeArea.rides.map((ride: any) => ({
            ...ride,
            queueTimes: queueTimeMap.get(ride.id) || [],
          })),
        }),
      );

      // Apply queue times to direct park rides
      const rides = Array.from(park.rides.values()).map((ride: any) => ({
        ...ride,
        queueTimes: queueTimeMap.get(ride.id) || [],
      }));

      return {
        ...park,
        themeAreas,
        rides,
        allRideIds: undefined, // Remove helper property
      };
    });

    // Batch weather data loading if needed
    let weatherDataMap = new Map<number, any>();
    if (includeWeather && parks.length > 0) {
      try {
        const parkIds = parks.map((p) => p.id);
        weatherDataMap =
          await this.weatherService.getBatchCompleteWeatherForParks(parkIds);
      } catch (error) {
        this.logger.warn('Error retrieving batch weather data:', error);
      }
    }

    // Transform parks with weather data and crowd levels
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

    const result = {
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

    // Cache the result using default TTL
    this.cacheService.set(cacheKey, result);
    return result;
  }
  /**
   * Get a single park by ID - Optimized version
   */
  async findOne(
    id: number,
    openThreshold?: number,
    includeCrowdLevel: boolean = true,
    includeWeather: boolean = true,
  ): Promise<any> {
    const threshold = openThreshold ?? this.getDefaultOpenThreshold();

    // Create cache key
    const cacheKey = `park:findOne:${id}:${JSON.stringify({
      threshold,
      includeCrowdLevel,
      includeWeather,
    })}`;

    // Check cache first
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Optimized single query to get park with all related data - queue times loaded separately
    const parkQuery = `
      SELECT 
        p.id as park_id,
        p."queueTimesId" as park_queue_times_id,
        p.name as park_name,
        p.country as park_country,
        p.continent as park_continent,
        p.latitude as park_latitude,
        p.longitude as park_longitude,
        p.timezone as park_timezone,
        pg.id as park_group_id,
        pg.name as park_group_name,
        pg."queueTimesId" as park_group_queue_times_id,
        ta.id as theme_area_id,
        ta."queueTimesId" as theme_area_queue_times_id,
        ta.name as theme_area_name,
        r.id as ride_id,
        r."queueTimesId" as ride_queue_times_id,
        r.name as ride_name,
        r."isActive" as ride_is_active,
        r."themeAreaId" as ride_theme_area_id,
        r."parkId" as ride_park_id
      FROM park p
      LEFT JOIN park_group pg ON p."parkGroupId" = pg.id
      LEFT JOIN theme_area ta ON ta."parkId" = p.id
      LEFT JOIN ride r ON (r."themeAreaId" = ta.id OR r."parkId" = p.id)
      WHERE p.id = $1
      ORDER BY ta.name ASC, r.name ASC
    `;

    const rawResults = await this.parkRepository.query(parkQuery, [id]);

    if (rawResults.length === 0) {
      throw new NotFoundException(`Park with ID ${id} not found`);
    }

    // Transform raw results into structured park data
    const firstRow = rawResults[0];
    const park = {
      id: firstRow.park_id,
      queueTimesId: firstRow.park_queue_times_id,
      name: firstRow.park_name,
      country: firstRow.park_country,
      continent: firstRow.park_continent,
      latitude: firstRow.park_latitude,
      longitude: firstRow.park_longitude,
      timezone: firstRow.park_timezone,
      parkGroup: firstRow.park_group_id
        ? {
            id: firstRow.park_group_id,
            name: firstRow.park_group_name,
            queueTimesId: firstRow.park_group_queue_times_id,
          }
        : null,
      themeAreas: new Map(),
      rides: new Map(),
    };

    const allRideIds = new Set<number>();

    // Process all rows to build theme areas and rides
    rawResults.forEach((row: any) => {
      if (row.ride_id) {
        const ride = {
          id: row.ride_id,
          queueTimesId: row.ride_queue_times_id,
          name: row.ride_name,
          isActive: row.ride_is_active,
          queueTimes: [], // Will be populated separately
        };

        allRideIds.add(row.ride_id);

        if (row.ride_theme_area_id && row.theme_area_id) {
          // Ride belongs to a theme area
          if (!park.themeAreas.has(row.theme_area_id)) {
            park.themeAreas.set(row.theme_area_id, {
              id: row.theme_area_id,
              queueTimesId: row.theme_area_queue_times_id,
              name: row.theme_area_name,
              rides: [],
            });
          }
          park.themeAreas.get(row.theme_area_id).rides.push(ride);
        } else if (row.ride_park_id === park.id) {
          // Direct park ride
          park.rides.set(row.ride_id, ride);
        }
      } else if (row.theme_area_id && !park.themeAreas.has(row.theme_area_id)) {
        // Theme area without rides
        park.themeAreas.set(row.theme_area_id, {
          id: row.theme_area_id,
          queueTimesId: row.theme_area_queue_times_id,
          name: row.theme_area_name,
          rides: [],
        });
      }
    });

    // Batch load latest queue times for all rides in this park
    let queueTimeMap = new Map();
    if (allRideIds.size > 0) {
      const rideIdsArray = Array.from(allRideIds);
      const latestQueueTimes = await this.parkRepository.query(
        `
        SELECT DISTINCT ON (qt."rideId") 
          qt."rideId",
          qt.id as queue_time_id,
          qt."waitTime",
          qt."isOpen",
          qt."lastUpdated",
          qt."recordedAt"
        FROM queue_time qt
        WHERE qt."rideId" = ANY($1)
        ORDER BY qt."rideId", qt."lastUpdated" DESC, qt."recordedAt" DESC
      `,
        [rideIdsArray],
      );

      // Create lookup map
      latestQueueTimes.forEach((qt) => {
        queueTimeMap.set(qt.rideId, [
          {
            id: qt.queue_time_id,
            waitTime: qt.waitTime,
            isOpen: qt.isOpen,
            lastUpdated: qt.lastUpdated,
            recordedAt: qt.recordedAt,
          },
        ]);
      });
    }

    // Convert Maps to Arrays and apply queue times to rides
    const finalPark = {
      ...park,
      themeAreas: Array.from(park.themeAreas.values()).map(
        (themeArea: any) => ({
          ...themeArea,
          rides: themeArea.rides.map((ride: any) => ({
            ...ride,
            queueTimes: queueTimeMap.get(ride.id) || [],
          })),
        }),
      ),
      rides: Array.from(park.rides.values()).map((ride: any) => ({
        ...ride,
        queueTimes: queueTimeMap.get(ride.id) || [],
      })),
    };

    // Batch weather data loading if needed
    let weatherDataMap = new Map<number, any>();
    if (includeWeather) {
      try {
        weatherDataMap =
          await this.weatherService.getBatchCompleteWeatherForParks([park.id]);
      } catch (error) {
        this.logger.warn(
          'Error retrieving weather data for single park:',
          error,
        );
      }
    }

    // Transform the data using helper function
    const result = await this.transformParkWithWeatherData(
      finalPark,
      weatherDataMap,
      threshold,
      includeCrowdLevel,
      includeWeather,
    );

    // Cache the result using default TTL
    this.cacheService.set(cacheKey, result);
    return result;
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
    // First load park structure without queue times to avoid memory issues
    const park = await this.parkRepository.findOne({
      where: { id: parkId },
      relations: {
        themeAreas: {
          rides: true,
        },
        rides: true,
      },
    });

    if (!park) {
      throw new NotFoundException(`Park with ID ${parkId} not found`);
    }

    // Get all ride IDs
    const allRides = [
      ...park.rides,
      ...(park.themeAreas?.flatMap((ta) => ta.rides) || []),
    ];

    // Create queue times map
    const queueTimeMap = new Map();

    if (allRides.length > 0) {
      const rideIds = allRides.map((ride) => ride.id);

      // Get only the most recent queue time for each ride using efficient query
      const latestQueueTimes = await this.parkRepository.query(
        `
        WITH latest_queue_times AS (
          SELECT DISTINCT ON (qt."rideId") 
            qt."rideId",
            qt."waitTime",
            qt."isOpen",
            qt."lastUpdated",
            qt."recordedAt"
          FROM queue_time qt
          WHERE qt."rideId" IN (${rideIds.map((_, i) => `$${i + 1}`).join(',')})
          ORDER BY qt."rideId", qt."lastUpdated" DESC, qt."recordedAt" DESC
        )
        SELECT * FROM latest_queue_times
      `,
        rideIds,
      );

      // Create a map for quick lookup
      latestQueueTimes.forEach((qt) => {
        queueTimeMap.set(qt.rideId, {
          waitTime: qt.waitTime,
          isOpen: qt.isOpen,
          lastUpdated: qt.lastUpdated,
          recordedAt: qt.recordedAt,
        });
      });
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
        currentQueueTime: queueTimeMap.get(ride.id) || null,
      })),
    );

    // Get direct park rides (if any)
    const directParkRides = (park.rides || []).map((ride) => ({
      id: ride.id,
      name: ride.name,
      isActive: ride.isActive,
      themeArea: null, // Direct park rides don't belong to a theme area
      currentQueueTime: queueTimeMap.get(ride.id) || null,
    }));

    // Combine all rides, avoiding duplicates
    const allRidesMap = new Map();
    themeAreaRides.forEach((ride) => allRidesMap.set(ride.id, ride));
    directParkRides.forEach((ride) => allRidesMap.set(ride.id, ride));
    const combinedRides = Array.from(allRidesMap.values());

    return {
      parkId: park.id,
      parkName: park.name,
      rides: combinedRides,
    };
  }

  /**
   * Get all parks for a given continent slug using direct SQL queries
   */
  async findParksByContinentSlug(
    continentSlug: string,
    query: ParkQueryDto = {},
  ): Promise<any> {
    const cacheKey = `continent:${continentSlug}:${JSON.stringify(query)}`;
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const continentVariations = this.generateNameVariations(continentSlug);

    const parks = await this.parkRepository
      .createQueryBuilder('park')
      .leftJoinAndSelect('park.parkGroup', 'parkGroup')
      .leftJoinAndSelect('park.themeAreas', 'themeAreas')
      .leftJoinAndSelect('themeAreas.rides', 'themeAreaRides')
      .leftJoinAndSelect('park.rides', 'rides')
      .where('LOWER(park.continent) IN (:...continents)', {
        continents: continentVariations.map((v) => v.toLowerCase()),
      })
      .orderBy('park.name', 'ASC')
      .getMany();

    let weatherDataMap = new Map<number, any>();
    if ((query.includeWeather ?? true) && parks.length > 0) {
      try {
        const parkIds = parks.map((p) => p.id);
        weatherDataMap =
          await this.weatherService.getBatchCompleteWeatherForParks(parkIds);
      } catch (error) {
        this.logger.warn(
          'Error retrieving weather data for continent query:',
          error,
        );
      }
    }

    const parksData = await Promise.all(
      parks.map((park) =>
        this.transformParkWithWeatherData(
          park,
          weatherDataMap,
          query.openThreshold ?? this.getDefaultOpenThreshold(),
          query.includeCrowdLevel ?? true,
          query.includeWeather ?? true,
        ),
      ),
    );

    const payload = {
      data: parksData,
      pagination: {
        page: 1,
        limit: parksData.length,
        totalCount: parksData.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };

    this.cacheService.set(cacheKey, payload); // Use default TTL
    return payload;
  }

  /**
   * Get all parks for a given country slug using direct SQL queries
   */
  async findParksByCountrySlug(
    countrySlug: string,
    query: ParkQueryDto = {},
  ): Promise<any> {
    const cacheKey = `country:${countrySlug}:${JSON.stringify(query)}`;
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const countryVariations = this.generateNameVariations(countrySlug);

    // Filter by country variations directly in SQL using query builder
    const parks = await this.parkRepository
      .createQueryBuilder('park')
      .leftJoinAndSelect('park.parkGroup', 'parkGroup')
      .leftJoinAndSelect('park.themeAreas', 'themeAreas')
      .leftJoinAndSelect('themeAreas.rides', 'themeAreaRides')
      .leftJoinAndSelect('park.rides', 'rides')
      .where('LOWER(park.country) IN (:...countries)', {
        countries: countryVariations.map((v) => v.toLowerCase()),
      })
      .orderBy('park.name', 'ASC')
      .getMany();

    let weatherDataMap = new Map<number, any>();
    if ((query.includeWeather ?? true) && parks.length > 0) {
      try {
        const parkIds = parks.map((p) => p.id);
        weatherDataMap =
          await this.weatherService.getBatchCompleteWeatherForParks(parkIds);
      } catch (error) {
        this.logger.warn(
          'Error retrieving weather data for country query:',
          error,
        );
      }
    }

    const parksData = await Promise.all(
      parks.map((park) =>
        this.transformParkWithWeatherData(
          park,
          weatherDataMap,
          query.openThreshold ?? this.getDefaultOpenThreshold(),
          query.includeCrowdLevel ?? true,
          query.includeWeather ?? true,
        ),
      ),
    );

    const payload = {
      data: parksData,
      pagination: {
        page: 1,
        limit: parksData.length,
        totalCount: parksData.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };

    this.cacheService.set(cacheKey, payload); // Use default TTL
    return payload;
  }

  /**
   * Find a park within a country by park slug using SQL queries
   */
  async findParkByCountryAndName(
    countrySlug: string,
    parkSlug: string,
  ): Promise<any | null> {
    const cacheKey = `park:${countrySlug}:${parkSlug}`;
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const countryVariations = this.generateNameVariations(countrySlug);
    const parkVariations = this.generateNameVariations(parkSlug);

    const queryBuilder = this.parkRepository
      .createQueryBuilder('park')
      .leftJoinAndSelect('park.parkGroup', 'parkGroup')
      .leftJoinAndSelect('park.themeAreas', 'themeAreas')
      .leftJoinAndSelect('themeAreas.rides', 'themeAreaRides')
      .leftJoinAndSelect('park.rides', 'rides')
      .where('LOWER(park.country) IN (:...countries)', {
        countries: countryVariations.map((v) => v.toLowerCase()),
      })
      .andWhere('LOWER(park.name) IN (:...parks)', {
        parks: parkVariations.map((v) => v.toLowerCase()),
      });

    const park = await queryBuilder.getOne();
    if (!park) {
      return null;
    }

    const allRides = [
      ...park.rides,
      ...(park.themeAreas?.flatMap((ta) => ta.rides) || []),
    ];

    if (allRides.length > 0) {
      const rideIds = allRides.map((ride) => ride.id);

      const latestQueueTimes = await this.parkRepository.query(
        `
        WITH latest_queue_times AS (
          SELECT DISTINCT ON (qt."rideId")
            qt."rideId",
            qt.id,
            qt."waitTime",
            qt."isOpen",
            qt."lastUpdated",
            qt."recordedAt"
          FROM queue_time qt
          WHERE qt."rideId" IN (${rideIds.map((_, i) => `$${i + 1}`).join(',')})
          ORDER BY qt."rideId", qt."lastUpdated" DESC, qt."recordedAt" DESC
        )
        SELECT * FROM latest_queue_times
      `,
        rideIds,
      );

      const queueTimeMap = new Map();
      latestQueueTimes.forEach((qt) => {
        queueTimeMap.set(qt.rideId, [
          {
            id: qt.id,
            waitTime: qt.waitTime,
            isOpen: qt.isOpen,
            lastUpdated: qt.lastUpdated,
            recordedAt: qt.recordedAt,
          },
        ]);
      });

      park.rides.forEach((ride) => {
        ride.queueTimes = queueTimeMap.get(ride.id) || [];
      });

      park.themeAreas?.forEach((themeArea) => {
        themeArea.rides?.forEach((ride) => {
          ride.queueTimes = queueTimeMap.get(ride.id) || [];
        });
      });
    }

    let weatherDataMap = new Map<number, any>();
    try {
      weatherDataMap =
        await this.weatherService.getBatchCompleteWeatherForParks([park.id]);
    } catch (error) {
      this.logger.warn('Error retrieving weather data for park:', error);
    }

    const transformed = await this.transformParkWithWeatherData(
      park,
      weatherDataMap,
      this.getDefaultOpenThreshold(),
      true,
      true,
    );

    this.cacheService.set(cacheKey, transformed); // Use default TTL
    return transformed;
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

    // First, find the park without loading all queue times to avoid memory issues
    const queryBuilder = this.parkRepository
      .createQueryBuilder('park')
      .leftJoinAndSelect('park.parkGroup', 'parkGroup')
      .leftJoinAndSelect('park.themeAreas', 'themeAreas')
      .leftJoinAndSelect('themeAreas.rides', 'themeAreaRides')
      .leftJoinAndSelect('park.rides', 'rides');

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

    if (!park) {
      return null;
    }

    // Now load only the latest queue time for each ride to avoid memory overflow
    const allRides = [
      ...park.rides,
      ...(park.themeAreas?.flatMap((ta) => ta.rides) || []),
    ];

    if (allRides.length > 0) {
      const rideIds = allRides.map((ride) => ride.id);

      // Get only the most recent queue time for each ride using a more efficient query
      const latestQueueTimes = await this.parkRepository.query(
        `
        WITH latest_queue_times AS (
          SELECT DISTINCT ON (qt."rideId") 
            qt."rideId",
            qt.id,
            qt."waitTime",
            qt."isOpen",
            qt."lastUpdated",
            qt."recordedAt"
          FROM queue_time qt
          WHERE qt."rideId" IN (${rideIds.map((_, i) => `$${i + 1}`).join(',')})
          ORDER BY qt."rideId", qt."lastUpdated" DESC, qt."recordedAt" DESC
        )
        SELECT * FROM latest_queue_times
      `,
        rideIds,
      );

      // Create a map for quick lookup
      const queueTimeMap = new Map();
      latestQueueTimes.forEach((qt) => {
        queueTimeMap.set(qt.rideId, [
          {
            id: qt.id,
            waitTime: qt.waitTime,
            isOpen: qt.isOpen,
            lastUpdated: qt.lastUpdated,
            recordedAt: qt.recordedAt,
          },
        ]);
      });

      // Attach the latest queue times to rides
      park.rides.forEach((ride) => {
        ride.queueTimes = queueTimeMap.get(ride.id) || [];
      });

      park.themeAreas?.forEach((themeArea) => {
        themeArea.rides?.forEach((ride) => {
          ride.queueTimes = queueTimeMap.get(ride.id) || [];
        });
      });
    }

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

    // First, find the ride without loading all queue times
    const park = await this.parkRepository
      .createQueryBuilder('park')
      .leftJoinAndSelect('park.themeAreas', 'themeAreas')
      .leftJoinAndSelect('themeAreas.rides', 'themeAreaRides')
      .leftJoinAndSelect('park.rides', 'rides')
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
    let targetRide = null;
    let targetThemeArea = null;

    for (const themeArea of park.themeAreas) {
      for (const ride of themeArea.rides) {
        if (
          rideVariations.some(
            (variation) => variation.toLowerCase() === ride.name.toLowerCase(),
          )
        ) {
          targetRide = ride;
          targetThemeArea = themeArea;
          break;
        }
      }
      if (targetRide) break;
    }

    // Check direct park rides if not found in theme areas
    if (!targetRide) {
      for (const ride of park.rides) {
        if (
          rideVariations.some(
            (variation) => variation.toLowerCase() === ride.name.toLowerCase(),
          )
        ) {
          targetRide = ride;
          break;
        }
      }
    }

    if (!targetRide) {
      return null;
    }

    // Load only the latest queue time for this specific ride
    const latestQueueTime = await this.ridesService.getLatestQueueTimeFromCache(targetRide.id);

    return {
      id: targetRide.id,
      queueTimesId: targetRide.queueTimesId,
      name: targetRide.name,
      isActive: targetRide.isActive,
      queueTime: latestQueueTime
        ? {
            id: latestQueueTime.id,
            waitTime: latestQueueTime.waitTime,
            isOpen: latestQueueTime.isOpen,
            lastUpdated: latestQueueTime.lastUpdated,
          }
        : null,
      themeArea: targetThemeArea
        ? {
            id: targetThemeArea.id,
            name: targetThemeArea.name,
          }
        : null,
    };
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
}
