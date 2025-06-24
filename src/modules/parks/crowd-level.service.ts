import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueTime } from './queue-time.entity.js';
import {
  CrowdLevel,
  Park as ParkType,
  Ride as RideType,
} from '../utils/park-utils.types.js';
import { ParkUtilsService } from '../utils/park-utils.service.js';
import { CacheService } from '../utils/cache.service.js';

type RideWithQueueTime = RideType & { latestQueueTime: QueueTime | null };

/**
 * Service for calculating park crowd levels based on historical queue time data
 */
@Injectable()
export class CrowdLevelService {
  private readonly logger = new Logger(CrowdLevelService.name);

  // Configuration constants
  private readonly TOP_RIDES_PERCENTAGE = 0.3; // Use top 30% of rides
  private readonly HISTORICAL_WINDOW_DAYS = 730; // 2 years
  private readonly PERCENTILE = 0.95; // 95th percentile
  private readonly MIN_DATA_POINTS = 10; // Minimum data points for reliable calculation

  constructor(
    @InjectRepository(QueueTime)
    private readonly queueTimeRepository: Repository<QueueTime>,
    private readonly parkUtils: ParkUtilsService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Calculate crowd level for a park using pre-loaded queue time data (cache-optimized)
   */
  async calculateCrowdLevelFromCache(
    park: ParkType,
    rideQueueTimeMap: Map<number, any>, // Pre-loaded queue times from cache
  ): Promise<CrowdLevel> {
    try {
      this.logger.debug(
        `Starting crowd level calculation for park: ${park.name} (cache version)`,
      );

      // Get all rides from the park and filter those with current queue time data
      const allRides = this.parkUtils.getAllRidesFromPark(park);
      const ridesWithCurrentData = allRides
        .map((ride) => {
          const currentQueueTime = rideQueueTimeMap.get(ride.id);
          return {
            ...ride,
            latestQueueTime: currentQueueTime || null,
          };
        })
        .filter((ride) => ride.latestQueueTime && ride.latestQueueTime.isOpen);

      if (ridesWithCurrentData.length === 0) {
        this.logger.debug(
          'No rides with current data found, returning default',
        );
        return this.getDefaultCrowdLevel(0, 0, 'No current data available');
      }

      this.logger.debug(
        `Found ${ridesWithCurrentData.length} rides with current data`,
      );

      // Determine how many top rides to use (minimum 3, maximum based on percentage)
      const topRidesCount = Math.max(
        3,
        Math.ceil(ridesWithCurrentData.length * this.TOP_RIDES_PERCENTAGE),
      );

      this.logger.debug(`Using top ${topRidesCount} rides for calculation`);

      // Sort rides by current wait time and take top X%
      const topRides = ridesWithCurrentData
        .sort((a, b) => this.getCurrentWaitTime(b) - this.getCurrentWaitTime(a))
        .slice(0, topRidesCount);

      this.logger.debug(
        `Top rides selected:`,
        topRides.map((r) => ({
          name: r.name,
          waitTime: this.getCurrentWaitTime(r),
        })),
      );

      // Calculate current average wait time of top rides
      const currentAverage = this.calculateAverageWaitTime(topRides);
      this.logger.debug(`Current average wait time: ${currentAverage}`);

      // Get historical baseline for these rides (still need database for historical data)
      const historicalBaseline = await this.calculateHistoricalBaseline(
        topRides.map((ride) => ride.id),
      );
      this.logger.debug(`Historical baseline: ${historicalBaseline}`);

      // Calculate crowd level percentage
      let crowdLevel = 0;
      if (historicalBaseline > 0) {
        crowdLevel = Math.round((currentAverage / historicalBaseline) * 100);
      }

      this.logger.debug(`Calculated crowd level: ${crowdLevel}%`);

      // Determine confidence based on available historical data
      const confidence = await this.calculateConfidence(
        topRides.map((ride) => ride.id),
      );

      this.logger.debug(`Confidence level: ${confidence}%`);

      // Get crowd level label
      const label = this.getCrowdLevelLabel(crowdLevel);

      return {
        level: crowdLevel,
        label,
        ridesUsed: topRides.length,
        totalRides: allRides.length,
        historicalBaseline,
        currentAverage,
        confidence,
        calculatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Error calculating crowd level from cache:', error);
      return this.getDefaultCrowdLevel(0, 0, 'Error calculating crowd level');
    }
  }

  /**
   * Get the current wait time for a ride
   * @param ride The ride to get the wait time for
   * @returns The current wait time or 0 if not available
   */
  private getCurrentWaitTime(ride: RideWithQueueTime): number {
    if (ride.latestQueueTime && ride.latestQueueTime.isOpen) {
      return ride.latestQueueTime.waitTime ?? 0;
    }
    return 0;
  }

  /**
   * Calculate the average wait time for a list of rides
   * @param rides The rides to calculate the average wait time for
   * @returns The average wait time
   */
  private calculateAverageWaitTime(rides: RideWithQueueTime[]): number {
    const waitTimes = rides
      .map((ride) => this.getCurrentWaitTime(ride))
      .filter((wt) => wt > 0);

    if (waitTimes.length === 0) {
      return 0;
    }
    const sum = waitTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / waitTimes.length);
  }

  /**
   * Calculate historical baseline (95th percentile) for given rides over the last 2 years
   * Uses caching to avoid expensive database queries for the same ride combinations
   */
  private async calculateHistoricalBaseline(
    rideIds: number[],
  ): Promise<number> {
    if (rideIds.length === 0) return 0;

    // Create cache key based on sorted ride IDs and current day
    // We use daily granularity since new queue time data comes in throughout the day
    const sortedRideIds = [...rideIds].sort((a, b) => a - b);
    const currentDay = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const cacheKey = `historical_baseline:${sortedRideIds.join(',')}:day:${currentDay}`;

    // Check cache first
    const cached = await this.cacheService.getAsync<number>(cacheKey);
    if (cached !== null && cached !== undefined) {
      this.logger.debug(
        `Historical baseline cache hit for ${rideIds.length} rides`,
      );
      return cached;
    }

    this.logger.debug(
      `Historical baseline cache miss, querying database for ${rideIds.length} rides`,
    );

    // Get historical data for the last 2 years
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.HISTORICAL_WINDOW_DAYS);

    const result = await this.queueTimeRepository.query(
      `
      WITH hourly AS (
        SELECT DATE_TRUNC('hour', qt."lastUpdated") AS hour_slot,
               AVG(qt."waitTime") AS avg_wait
        FROM queue_time qt
        WHERE qt."rideId" = ANY($1)
          AND qt."lastUpdated" >= $2
          AND qt."isOpen" = true
          AND qt."waitTime" > 0
        GROUP BY hour_slot
      )
      SELECT COUNT(*) AS count,
             PERCENTILE_CONT($3) WITHIN GROUP (ORDER BY avg_wait) AS percentile
      FROM hourly
      `,
      [rideIds, cutoffDate.toISOString(), this.PERCENTILE],
    );

    const row = result[0];
    let baseline = 0;

    if (row && parseInt(row.count, 10) >= this.MIN_DATA_POINTS) {
      baseline = parseFloat(row.percentile);
    }

    // Cache the result for 4 hours (refreshes multiple times per day as new data comes in)
    await this.cacheService.setAsync(cacheKey, baseline, 4 * 3600);

    return baseline;
  }

  /**
   * Calculate confidence level based on available historical data coverage
   * Uses caching to avoid expensive database queries for the same ride combinations
   */
  private async calculateConfidence(rideIds: number[]): Promise<number> {
    if (rideIds.length === 0) return 0;

    // Create cache key based on sorted ride IDs and current day
    const sortedRideIds = [...rideIds].sort((a, b) => a - b);
    const currentDay = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const cacheKey = `confidence:${sortedRideIds.join(',')}:day:${currentDay}`;

    // Check cache first
    const cached = await this.cacheService.getAsync<number>(cacheKey);
    if (cached !== null && cached !== undefined) {
      this.logger.debug(`Confidence cache hit for ${rideIds.length} rides`);
      return cached;
    }

    this.logger.debug(
      `Confidence cache miss, querying database for ${rideIds.length} rides`,
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.HISTORICAL_WINDOW_DAYS);

    const dataRange = await this.queueTimeRepository.query(
      `
      SELECT MIN(qt."lastUpdated") AS "firstDate",
             MAX(qt."lastUpdated") AS "lastDate",
             COUNT(*) AS "totalCount"
      FROM queue_time qt
      WHERE qt."rideId" = ANY($1)
        AND qt."lastUpdated" >= $2
        AND qt."isOpen" = true
        AND qt."waitTime" > 0
      `,
      [rideIds, cutoffDate.toISOString()],
    );

    const rangeRow = dataRange[0];
    let confidence = 10; // Default minimum confidence

    if (rangeRow && rangeRow.firstDate && rangeRow.totalCount !== '0') {
      const firstDataDate = new Date(rangeRow.firstDate);
      const lastDataDate = new Date(rangeRow.lastDate);

      // Calculate actual data coverage (days between first and last data point)
      const actualDataDays = Math.ceil(
        (lastDataDate.getTime() - firstDataDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      // Calculate coverage percentage against the full historical window
      const coveragePercentage = Math.min(
        100,
        (actualDataDays / this.HISTORICAL_WINDOW_DAYS) * 100,
      );

      // Also consider data density (minimum data points per day)
      const totalCount = parseInt(rangeRow.totalCount, 10);
      const expectedDataPointsPerDay = 24; // Assuming hourly data
      const expectedTotalPoints =
        this.HISTORICAL_WINDOW_DAYS * expectedDataPointsPerDay * rideIds.length;
      const densityPercentage = Math.min(
        100,
        (totalCount / expectedTotalPoints) * 100,
      );

      // Final confidence is the average of coverage and density, weighted towards coverage
      confidence = Math.round(
        coveragePercentage * 0.7 + densityPercentage * 0.3,
      );

      confidence = Math.max(10, Math.min(100, confidence)); // Between 10% and 100%
    }

    // Cache the result for 4 hours (refreshes multiple times per day as new data comes in)
    await this.cacheService.setAsync(cacheKey, confidence, 4 * 3600);

    return confidence;
  }

  /**
   * Get descriptive label for crowd level
   */
  private getCrowdLevelLabel(level: number): CrowdLevel['label'] {
    if (level < 30) return 'Very Low';
    if (level < 60) return 'Low';
    if (level < 120) return 'Moderate';
    if (level < 160) return 'High';
    if (level < 200) return 'Very High';
    return 'Extreme';
  }
  /**
   * Get default crowd level when calculation is not possible
   */
  private getDefaultCrowdLevel(
    ridesUsed: number,
    totalRides: number,
    reason: string,
  ): CrowdLevel {
    return {
      level: 0,
      label: 'Very Low',
      ridesUsed,
      totalRides,
      historicalBaseline: 0,
      currentAverage: 0,
      confidence: 0,
      calculatedAt: new Date(),
    };
  }
}
