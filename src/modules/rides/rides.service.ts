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
      const latestQueueTimes = await this.rideRepository.query(
        `
        WITH latest_queue_times AS (
          SELECT DISTINCT ON (qt."rideId")
            qt."rideId",
            qt.id,
            qt."waitTime",
            qt."isOpen",
            qt."lastUpdated"
          FROM queue_time qt
          WHERE qt."rideId" IN (${rideIds.map((_, i) => `$${i + 1}`).join(',')})
          ORDER BY qt."rideId", qt."lastUpdated" DESC, qt."recordedAt" DESC
        )
        SELECT * FROM latest_queue_times
      `,
        rideIds,
      );

      latestQueueTimes.forEach((qt) => {
        queueTimeMap.set(qt.rideId, {
          id: qt.id,
          waitTime: qt.waitTime,
          isOpen: qt.isOpen,
          lastUpdated: qt.lastUpdated,
        });
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

    const currentQueueTime = await this.parkUtils.getCurrentQueueTimeFromDb(
      ride.id,
    );

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
