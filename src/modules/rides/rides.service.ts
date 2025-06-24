import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ride } from '../parks/ride.entity.js';
import { QueueTime } from '../parks/queue-time.entity.js';
import { RideQueryDto } from './rides.dto.js';
import { ParkUtilsService } from '../utils/park-utils.service.js';

@Injectable()
export class RidesService {
  constructor(
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
    @InjectRepository(QueueTime)
    private readonly queueTimeRepository: Repository<QueueTime>,
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

  /**
   * Get the latest queue time for a specific ride (optimized for large datasets)
   */
  async getLatestQueueTimeForRide(rideId: number): Promise<QueueTime | null> {
    return await this.queueTimeRepository
      .createQueryBuilder('queueTime')
      .where('queueTime.ride = :rideId', { rideId })
      .orderBy('queueTime.lastUpdated', 'DESC')
      .addOrderBy('queueTime.recordedAt', 'DESC')
      .limit(1)
      .getOne();
  }

  /**
   * Get the latest queue time for multiple rides (optimized batch operation)
   * Returns a Map with rideId as key and QueueTime as value
   */
  async getLatestQueueTimesForRides(rideIds: number[]): Promise<Map<number, QueueTime>> {
    if (rideIds.length === 0) {
      return new Map();
    }

    const latestQueueTimes = await this.queueTimeRepository
      .createQueryBuilder('queueTime')
      .select([
        'queueTime.id',
        'queueTime.waitTime', 
        'queueTime.isOpen',
        'queueTime.lastUpdated',
        'queueTime.recordedAt'
      ])
      .addSelect('queueTime.rideId', 'rideId')
      .where('queueTime.ride IN (:...rideIds)', { rideIds })
      .andWhere(`queueTime.id IN (
        SELECT DISTINCT ON (qt."rideId") qt.id
        FROM queue_time qt
        WHERE qt."rideId" IN (:...rideIds)
        ORDER BY qt."rideId", qt."lastUpdated" DESC, qt."recordedAt" DESC
      )`)
      .getRawAndEntities();

    const queueTimeMap = new Map<number, QueueTime>();
    latestQueueTimes.entities.forEach((queueTime, index) => {
      const rideId = latestQueueTimes.raw[index].rideId;
      queueTimeMap.set(rideId, queueTime);
    });

    return queueTimeMap;
  }
}
