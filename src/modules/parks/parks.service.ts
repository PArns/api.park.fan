import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
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
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get the default park open threshold from configuration
   */
  private getDefaultOpenThreshold(): number {
    return this.configService.get<number>('PARK_OPEN_THRESHOLD_PERCENT', 50);
  }

  /**
   * Helper function to extract current queue time from a ride
   */
  private getCurrentQueueTime(ride: any) {
    return ride.queueTimes && ride.queueTimes.length > 0
      ? {
          waitTime: ride.queueTimes[0].waitTime,
          isOpen: ride.queueTimes[0].isOpen,
          lastUpdated: ride.queueTimes[0].lastUpdated,
        }
      : null;
  }

  /**
   * Helper function to calculate if a park is open based on the percentage of open rides
   */
  private calculateParkOpenStatus(park: any, openThreshold?: number): {
    isOpen: boolean;
    openRideCount: number;
    totalRideCount: number;
    operatingPercentage: number;
  } {
    const threshold = openThreshold ?? this.getDefaultOpenThreshold();
    
    // Get all rides from all theme areas
    const allRides = park.themeAreas.flatMap((themeArea: any) => themeArea.rides);
    const totalRideCount = allRides.length;
    
    if (totalRideCount === 0) {
      return {
        isOpen: false,
        openRideCount: 0,
        totalRideCount: 0,
        operatingPercentage: 0,
      };
    }

    // Count rides that are currently open (have queue time data and isOpen = true)
    const openRideCount = allRides.filter((ride: any) => {
      const currentQueueTime = this.getCurrentQueueTime(ride);
      return currentQueueTime && currentQueueTime.isOpen;
    }).length;

    const operatingPercentage = Math.round((openRideCount / totalRideCount) * 100);
    const isOpen = operatingPercentage >= threshold;

    return {
      isOpen,
      openRideCount,
      totalRideCount,
      operatingPercentage,
    };
  }

  /**
   * Helper function to calculate wait time distribution for a park
   */
  private calculateWaitTimeDistribution(park: any): {
    '0-10': number;
    '11-30': number;
    '31-60': number;
    '61-120': number;
    '120+': number;
  } {
    const waitTimeDistribution = {
      '0-10': 0,
      '11-30': 0,
      '31-60': 0,
      '61-120': 0,
      '120+': 0,
    };

    // Get all rides from all theme areas
    const allRides = park.themeAreas.flatMap((themeArea: any) => themeArea.rides);

    // Calculate wait time distribution
    allRides.forEach(ride => {
      const currentQueueTime = this.getCurrentQueueTime(ride);
      if (currentQueueTime && currentQueueTime.isOpen && currentQueueTime.waitTime !== null) {
        const waitTime = currentQueueTime.waitTime;
        if (waitTime <= 10) waitTimeDistribution['0-10']++;
        else if (waitTime <= 30) waitTimeDistribution['11-30']++;
        else if (waitTime <= 60) waitTimeDistribution['31-60']++;
        else if (waitTime <= 120) waitTimeDistribution['61-120']++;
        else waitTimeDistribution['120+']++;
      }
    });

    return waitTimeDistribution;
  }

  /**
   * Helper function to transform rides with current queue times
   */
  private transformRide(ride: any) {
    return {
      ...ride,
      currentQueueTime: this.getCurrentQueueTime(ride),
      queueTimes: undefined, // Remove the full queueTimes array from response
    };
  }

  /**
   * Helper function to transform theme areas with rides
   */
  private transformThemeArea(themeArea: any) {
    return {
      ...themeArea,
      rides: themeArea.rides.map((ride) => this.transformRide(ride)),
    };
  }

  /**
   * Helper function to transform parks with theme areas and rides
   */
  private transformPark(park: any, openThreshold?: number) {
    const openStatus = this.calculateParkOpenStatus(park, openThreshold);
    const waitTimeDistribution = this.calculateWaitTimeDistribution(park);
    
    return {
      ...park,
      themeAreas: park.themeAreas.map((themeArea) =>
        this.transformThemeArea(themeArea),
      ),
      operatingStatus: openStatus,
      waitTimeDistribution, // Add wait time distribution to park data
    };
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
    } = query;
    const threshold = openThreshold ?? this.getDefaultOpenThreshold();
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
    } // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Order by name
    queryBuilder.orderBy('park.name', 'ASC');

    // Get total count for pagination
    const totalCount = await queryBuilder.getCount();
    const parks = await queryBuilder.getMany();

    // Transform the data using helper functions
    const transformedParks = parks.map((park) => this.transformPark(park, threshold));

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
  async findOne(id: number, openThreshold?: number): Promise<any> {
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

    // Transform the data using helper functions
    return this.transformPark(park, openThreshold);
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
      },
    });

    if (!park) {
      throw new NotFoundException(`Park with ID ${parkId} not found`);
    } // Flatten all rides from all theme areas and transform them
    const allRides = park.themeAreas.flatMap((themeArea) =>
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

    return {
      parkId: park.id,
      parkName: park.name,
      rides: allRides,
    };
  }
}
