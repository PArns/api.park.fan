import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Park } from './park.entity.js';
import { ParkGroup } from './park-group.entity.js';
import { ThemeArea } from './theme-area.entity.js';
import { Ride } from './ride.entity.js';
import { ParkQueryDto } from './parks.dto.js';

@Injectable()
export class ParksService {
  private readonly logger = new Logger(ParksService.name);

  constructor(
    @InjectRepository(Park)
    private readonly parkRepository: Repository<Park>,
    @InjectRepository(ParkGroup)
    private readonly parkGroupRepository: Repository<ParkGroup>,
    @InjectRepository(ThemeArea)
    private readonly themeAreaRepository: Repository<ThemeArea>,
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
  ) {}

  /**
   * Get all parks with optional filtering and pagination
   */
  async findAll(query: ParkQueryDto = {}) {
    const {
      search,
      country,
      continent,
      parkGroupId,
      page = 1,
      limit = 10,
    } = query;
    const queryBuilder = this.parkRepository
      .createQueryBuilder('park')
      .leftJoinAndSelect('park.parkGroup', 'parkGroup')
      .leftJoinAndSelect('park.themeAreas', 'themeAreas')
      .leftJoinAndSelect('themeAreas.rides', 'rides')
      .leftJoinAndSelect(
        'rides.queueTimes',
        'queueTimes',
        'queueTimes.lastUpdated = (SELECT MAX(qt."lastUpdated") FROM queue_time qt WHERE qt."rideId" = rides.id)',
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
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Order by name
    queryBuilder.orderBy('park.name', 'ASC'); // Get total count for pagination
    const totalCount = await queryBuilder.getCount();
    const parks = await queryBuilder.getMany();

    // Transform the data to include current queue time
    const transformedParks = parks.map((park) => ({
      ...park,
      themeAreas: park.themeAreas.map((themeArea) => ({
        ...themeArea,
        rides: themeArea.rides.map((ride) => ({
          ...ride,
          currentQueueTime:
            ride.queueTimes && ride.queueTimes.length > 0
              ? ride.queueTimes[0]
              : null,
          queueTimes: undefined, // Remove the full queueTimes array from response
        })),
      })),
    }));
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
  async findOne(id: number): Promise<any> {
    const park = await this.parkRepository
      .createQueryBuilder('park')
      .leftJoinAndSelect('park.parkGroup', 'parkGroup')
      .leftJoinAndSelect('park.themeAreas', 'themeAreas')
      .leftJoinAndSelect('themeAreas.rides', 'rides')
      .leftJoinAndSelect(
        'rides.queueTimes',
        'queueTimes',
        'queueTimes.lastUpdated = (SELECT MAX(qt."lastUpdated") FROM queue_time qt WHERE qt."rideId" = rides.id)',
      )
      .where('park.id = :id', { id })
      .getOne();

    if (!park) {
      throw new NotFoundException(`Park with ID ${id} not found`);
    }

    // Transform the data to include current queue time
    const transformedPark = {
      ...park,
      themeAreas: park.themeAreas.map((themeArea) => ({
        ...themeArea,
        rides: themeArea.rides.map((ride) => ({
          ...ride,
          currentQueueTime:
            ride.queueTimes && ride.queueTimes.length > 0
              ? ride.queueTimes[0]
              : null,
          queueTimes: undefined, // Remove the full queueTimes array from response
        })),
      })),
    };

    return transformedPark;
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
   * Get park statistics
   */
  async getStatistics() {
    const totalParks = await this.parkRepository.count();
    const totalThemeAreas = await this.themeAreaRepository.count();
    const totalRides = await this.rideRepository.count();

    const parksByCountry = await this.parkRepository
      .createQueryBuilder('park')
      .select('park.country', 'country')
      .addSelect('COUNT(park.id)', 'count')
      .groupBy('park.country')
      .orderBy('count', 'DESC')
      .getRawMany();

    const parksByContinent = await this.parkRepository
      .createQueryBuilder('park')
      .select('park.continent', 'continent')
      .addSelect('COUNT(park.id)', 'count')
      .groupBy('park.continent')
      .orderBy('count', 'DESC')
      .getRawMany();

    return {
      totalParks,
      totalThemeAreas,
      totalRides,
      parksByCountry: parksByCountry.map((item) => ({
        country: item.country,
        count: parseInt(item.count),
      })),
      parksByContinent: parksByContinent.map((item) => ({
        continent: item.continent,
        count: parseInt(item.count),
      })),
    };
  }

  /**
   * Get all countries that have parks
   */
  async getCountries(): Promise<string[]> {
    const result = await this.parkRepository
      .createQueryBuilder('park')
      .select('DISTINCT park.country', 'country')
      .orderBy('park.country', 'ASC')
      .getRawMany();

    return result.map((item) => item.country).filter(Boolean);
  }

  /**
   * Get all continents that have parks
   */
  async getContinents(): Promise<string[]> {
    const result = await this.parkRepository
      .createQueryBuilder('park')
      .select('DISTINCT park.continent', 'continent')
      .orderBy('park.continent', 'ASC')
      .getRawMany();

    return result.map((item) => item.continent).filter(Boolean);
  }
}
