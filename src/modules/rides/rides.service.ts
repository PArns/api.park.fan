import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ride } from '../parks/ride.entity.js';
import { RideQueryDto } from './rides.dto.js';
import { ParkUtilsService } from '../utils/park-utils.service.js';

@Injectable()
export class RidesService {
  constructor(
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
    private readonly parkUtils: ParkUtilsService,
  ) {}

  /**
   * Helper function to extract current queue time from a ride
   * @private
   */
  private getCurrentQueueTime(ride: any) {
    return this.parkUtils.getCurrentQueueTime(ride);
  }

  /**
   * Get all rides with optional filtering
   */
  async findAll(query: RideQueryDto = {}) {
    const { search, parkId, isActive = true, page = 1, limit = 50 } = query;

    const queryBuilder = this.rideRepository
      .createQueryBuilder('ride')
      .leftJoinAndSelect('ride.park', 'park')
      .leftJoinAndSelect('ride.themeArea', 'themeArea')
      .leftJoinAndSelect(
        'ride.queueTimes',
        'queueTimes',
        'queueTimes.lastUpdated = (SELECT MAX(qt."lastUpdated") FROM queue_time qt WHERE qt."rideId" = ride.id)',
      );

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

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Order by name
    queryBuilder.orderBy('ride.name', 'ASC');

    const totalCount = await queryBuilder.getCount();
    const rides = await queryBuilder.getMany();

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
      currentQueueTime: this.getCurrentQueueTime(ride),
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
    const ride = await this.rideRepository
      .createQueryBuilder('ride')
      .leftJoinAndSelect('ride.park', 'park')
      .leftJoinAndSelect('ride.themeArea', 'themeArea')
      .leftJoinAndSelect('ride.queueTimes', 'queueTimes')
      .where('ride.id = :id', { id })
      .orderBy('queueTimes.recordedAt', 'DESC')
      .getOne();

    if (!ride) {
      throw new NotFoundException(`Ride with ID ${id} not found`);
    }

    // Get the most recent queue time for this ride
    const currentQueueTime = this.getCurrentQueueTime(ride);

    return {
      id: ride.id,
      name: ride.name,
      isActive: ride.isActive,
      park: ride.park,
      themeArea: ride.themeArea,
      currentQueueTime,
    };
  }
}
