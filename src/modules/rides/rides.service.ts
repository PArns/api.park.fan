import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ride } from '../parks/ride.entity.js';
import { RideQueryDto } from './rides.dto.js';
import { ParkUtilsService } from '../utils/park-utils.service.js';
import { CacheService } from '../utils/cache.service.js';

@Injectable()
export class RidesService {
  constructor(
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
    private readonly parkUtils: ParkUtilsService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get all rides with optional filtering
   */
  async findAll(query: RideQueryDto = {}) {
    const { search, parkId, isActive = true, page = 1, limit = 50 } = query;

    const queryBuilder = this.rideRepository
      .createQueryBuilder('ride')
      .leftJoinAndSelect('ride.park', 'park')
      .leftJoinAndSelect('ride.themeArea', 'themeArea');

    // Apply filters
    if (search) {
      queryBuilder.andWhere('LOWER(ride.name) LIKE LOWER(:search)', {
        search: `%${search}%`,
      });
    }

    if (parkId) {
      queryBuilder.andWhere('ride.park.id = :parkId', { parkId });
    }

    // Filter by active status (defaults to true)
    queryBuilder.andWhere('ride.isActive = :isActive', { isActive });

    // Get total count before pagination
    const totalCount = await queryBuilder.getCount();

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Order by name
    queryBuilder.orderBy('ride.name', 'ASC');

    const rides = await queryBuilder.getMany();

    const rideIds = rides.map((ride) => ride.id);
    const queueTimeMap = new Map();

    if (rideIds.length > 0) {
      // Use Redis cache instead of database query
      const cacheQueueTimes = await this.getLatestQueueTimesFromCache(rideIds);
      cacheQueueTimes.forEach((queueTime, rideId) => {
        queueTimeMap.set(rideId, queueTime);
      });
    }

    // Transform the data to include current queue time
    const transformedRides = rides.map((ride) => ({
      id: ride.id,
      name: ride.name,
      isActive: ride.isActive,
      park: {
        id: ride.park.id,
        name: ride.park.name,
        continent: ride.park.continent || null,
        country: ride.park.country || null,
      },
      themeArea: ride.themeArea
        ? {
            id: ride.themeArea.id,
            name: ride.themeArea.name,
          }
        : null,
      currentQueueTime: queueTimeMap.get(ride.id) || null,
    }));

    return {
      data: transformedRides,
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
   * Get a specific ride by ID with current queue time only
   */
  async findOne(id: number) {
    const ride = await this.rideRepository.findOne({
      where: { id },
      relations: {
        park: true,
        themeArea: true,
      },
    });

    if (!ride) {
      throw new NotFoundException(`Ride with ID ${id} not found`);
    }

    // Use cache instead of database query
    const currentQueueTime = await this.getLatestQueueTimeFromCache(ride.id);

    return {
      id: ride.id,
      name: ride.name,
      isActive: ride.isActive,
      park: ride.park,
      themeArea: ride.themeArea,
      currentQueueTime,
    };
  }

  /**
   * Get the latest queue time for a specific ride from Redis cache
   */
  async getLatestQueueTimeFromCache(rideId: number): Promise<any | null> {
    try {
      const cacheKey = `latest_queue_time_${rideId}`;
      const cachedData = (await this.cacheService.getAsync(cacheKey)) as any;

      if (cachedData && cachedData.waitTime !== undefined) {
        return {
          waitTime: cachedData.waitTime,
          isOpen: cachedData.isOpen,
          lastUpdated: cachedData.lastUpdated,
        };
      }

      return null;
    } catch (error) {
      console.error(
        `Error getting queue time from cache for ride ${rideId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get the latest queue times for multiple rides from Redis cache (optimized with pipeline)
   */
  async getLatestQueueTimesFromCache(
    rideIds: number[],
  ): Promise<Map<number, any>> {
    const queueTimesMap = new Map<number, any>();

    if (rideIds.length === 0) {
      return queueTimesMap;
    }

    try {
      // Use Redis pipeline for batch operations
      const redis = this.cacheService.getRedisClient();
      const pipeline = redis.pipeline();

      // Prepare all cache keys
      const cacheKeys = rideIds.map((rideId) => `latest_queue_time_${rideId}`);

      // Add all get operations to pipeline
      cacheKeys.forEach((key) => {
        pipeline.get(key);
      });

      // Execute all operations at once
      const results = await pipeline.exec();

      if (!results) {
        console.warn('Redis pipeline returned null results');
        return queueTimesMap;
      }

      // Process results
      results.forEach(([error, result], index) => {
        if (error) {
          console.error(`Error getting cache key ${cacheKeys[index]}:`, error);
          return;
        }

        if (result) {
          try {
            const cachedData = JSON.parse(result as string);
            if (cachedData && cachedData.waitTime !== undefined) {
              queueTimesMap.set(rideIds[index], {
                waitTime: cachedData.waitTime,
                isOpen: cachedData.isOpen,
                lastUpdated: cachedData.lastUpdated,
              });
            }
          } catch (parseError) {
            console.error(
              `Error parsing cache data for ride ${rideIds[index]}:`,
              parseError,
            );
          }
        }
      });
    } catch (error) {
      console.error('Error in batch cache loading:', error);
      throw error;
    }

    return queueTimesMap;
  }
}
