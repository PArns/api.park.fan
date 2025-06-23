import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ride as RideEntity } from '../parks/ride.entity';
import { QueueTime as QueueTimeEntity } from '../parks/queue-time.entity';
import {
  Park,
  Ride as RideType,
  WaitTimeDistribution,
  ParkOperatingStatus,
  QueueTime,
} from './park-utils.types.js';

/**
 * Shared utilities for park and ride operations
 * Used across multiple services to prevent code duplication
 */
@Injectable()
export class ParkUtilsService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(RideEntity)
    private readonly rideRepository: Repository<RideEntity>,
    @InjectRepository(QueueTimeEntity)
    private readonly queueTimeRepository: Repository<QueueTimeEntity>,
  ) {}

  /**
   * Get the default park open threshold from configuration
   * @returns Percentage threshold for considering a park "open" (default: 50)
   */
  getDefaultOpenThreshold(): number {
    return this.configService.get<number>('PARK_OPEN_THRESHOLD_PERCENT', 50);
  }

  /**
   * Helper function to get all rides from a park (both from theme areas and direct park rides)
   * @param park Park object with themeAreas and rides
   * @returns Array of all rides
   */
  getAllRidesFromPark(park: Park): RideType[] {
    // Get rides from theme areas
    const themeAreaRides = park.themeAreas.flatMap(
      (themeArea) => themeArea.rides,
    );

    // Get direct park rides (if any)
    const directParkRides = park.rides || [];

    // Combine both arrays, avoiding duplicates (rides might be in both)
    const allRidesMap = new Map<number, RideType>();

    // Add theme area rides
    themeAreaRides.forEach((ride: RideType) => allRidesMap.set(ride.id, ride));

    // Add direct park rides (this will overwrite theme area rides if there are duplicates)
    directParkRides.forEach((ride: RideType) => allRidesMap.set(ride.id, ride));

    return Array.from(allRidesMap.values());
  }

  /**
   * Get the latest queue time for a ride directly from the database
   */
  async getCurrentQueueTimeFromDb(rideId: number): Promise<QueueTime | null> {
    const latest = await this.queueTimeRepository
      .createQueryBuilder('qt')
      .where('qt."rideId" = :rideId', { rideId })
      .orderBy('qt."lastUpdated"', 'DESC')
      .limit(1)
      .getOne();

    return latest
      ? {
          waitTime: latest.waitTime,
          isOpen: latest.isOpen,
          lastUpdated: latest.lastUpdated,
        }
      : null;
  }
  /**
   * Helper function to calculate if a park is open based on the percentage of open rides
   * @param park Park object with themeAreas containing rides
   * @param openThreshold Optional percentage threshold (0-100)
   * @returns Boolean indicating if the park is considered "open"
   */
  async calculateParkOpenStatus(
    park: Park,
    openThreshold?: number,
  ): Promise<boolean> {
    const status = await this.getDetailedParkOpenStatusFromDb(
      park.id,
      openThreshold,
    );
    return status.isOpen;
  }
  /**
   * Helper function to get detailed park open status with additional metrics
   * @param park Park object with themeAreas containing rides
   * @param openThreshold Optional percentage threshold (0-100)
   * @returns Detailed operating status including counts and percentages
   */
  async getDetailedParkOpenStatus(
    park: Park,
    openThreshold?: number,
  ): Promise<ParkOperatingStatus> {
    return this.getDetailedParkOpenStatusFromDb(park.id, openThreshold);
  }

  /**
   * Optimized version of getDetailedParkOpenStatus using direct SQL queries
   */
  async getDetailedParkOpenStatusFromDb(
    parkId: number,
    openThreshold?: number,
  ): Promise<ParkOperatingStatus> {
    const threshold = openThreshold ?? this.getDefaultOpenThreshold();

    const latestSubQuery = this.queueTimeRepository
      .createQueryBuilder('qt')
      .distinctOn(['qt."rideId"'])
      .select('qt."rideId"', 'rideId')
      .addSelect('qt."isOpen"', 'isOpen')
      .innerJoin(RideEntity, 'r', 'r.id = qt."rideId"')
      .where('r."parkId" = :parkId', { parkId })
      .orderBy('qt."rideId"')
      .addOrderBy('qt."lastUpdated"', 'DESC')
      .addOrderBy('qt."recordedAt"', 'DESC');

    const row = await this.queueTimeRepository
      .createQueryBuilder()
      .select('COUNT(*)', 'totalRideCount')
      .addSelect(
        'COUNT(*) FILTER (WHERE latest."isOpen" = true)',
        'openRideCount',
      )
      .from('(' + latestSubQuery.getQuery() + ')', 'latest')
      .setParameters(latestSubQuery.getParameters())
      .getRawOne();

    const resultRow = row || { totalRideCount: '0', openRideCount: '0' };
    const totalRideCount = parseInt(resultRow.totalRideCount, 10);
    const openRideCount = parseInt(resultRow.openRideCount, 10);
    const operatingPercentage =
      totalRideCount > 0
        ? Math.round((openRideCount / totalRideCount) * 100)
        : 0;

    return {
      isOpen: operatingPercentage >= threshold,
      openRideCount,
      totalRideCount,
      operatingPercentage,
    };
  }

  /**
   * Optimized version of calculateWaitTimeDistribution using direct SQL queries
   */
  async calculateWaitTimeDistributionFromDb(
    parkId: number,
  ): Promise<WaitTimeDistribution> {
    const latestSubQuery = this.queueTimeRepository
      .createQueryBuilder('qt')
      .distinctOn(['qt."rideId"'])
      .select('qt."rideId"', 'rideId')
      .addSelect('qt."isOpen"', 'isOpen')
      .addSelect('qt."waitTime"', 'waitTime')
      .innerJoin(RideEntity, 'r', 'r.id = qt."rideId"')
      .where('r."parkId" = :parkId', { parkId })
      .orderBy('qt."rideId"')
      .addOrderBy('qt."lastUpdated"', 'DESC')
      .addOrderBy('qt."recordedAt"', 'DESC');

    const row = await this.queueTimeRepository
      .createQueryBuilder()
      .select('COUNT(CASE WHEN latest."waitTime" <= 10 THEN 1 END)', '0-10')
      .addSelect(
        'COUNT(CASE WHEN latest."waitTime" > 10 AND latest."waitTime" <= 30 THEN 1 END)',
        '11-30',
      )
      .addSelect(
        'COUNT(CASE WHEN latest."waitTime" > 30 AND latest."waitTime" <= 60 THEN 1 END)',
        '31-60',
      )
      .addSelect(
        'COUNT(CASE WHEN latest."waitTime" > 60 AND latest."waitTime" <= 120 THEN 1 END)',
        '61-120',
      )
      .addSelect('COUNT(CASE WHEN latest."waitTime" > 120 THEN 1 END)', '120+')
      .from('(' + latestSubQuery.getQuery() + ')', 'latest')
      .where('latest."isOpen" = true AND latest."waitTime" IS NOT NULL')
      .setParameters(latestSubQuery.getParameters())
      .getRawOne();

    if (!row) {
      return {
        '0-10': 0,
        '11-30': 0,
        '31-60': 0,
        '61-120': 0,
        '120+': 0,
      };
    }

    return {
      '0-10': parseInt(row['0-10'], 10) || 0,
      '11-30': parseInt(row['11-30'], 10) || 0,
      '31-60': parseInt(row['31-60'], 10) || 0,
      '61-120': parseInt(row['61-120'], 10) || 0,
      '120+': parseInt(row['120+'], 10) || 0,
    };
  }
  /**
   * Helper function to calculate wait time distribution for a park
   * @param park Park object with themeAreas containing rides
   * @returns Wait time distribution object with counts for each time range
   */
  async calculateWaitTimeDistribution(
    park: Park,
  ): Promise<WaitTimeDistribution> {
    return this.calculateWaitTimeDistributionFromDb(park.id);
  }
}
