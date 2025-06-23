import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueTime } from './queue-time.entity.js';
import { CrowdLevel, Park as ParkType } from '../utils/park-utils.types.js';
import { ParkUtilsService } from '../utils/park-utils.service.js';

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
  ) {}

  /**
   * Calculate crowd level for a park
   */
  async calculateCrowdLevel(park: ParkType): Promise<CrowdLevel> {
    try {
      this.logger.debug(
        `Starting crowd level calculation for park: ${park.name}`,
      );

      // Get all rides from the park that have recent queue time data
      const ridesWithCurrentData = this.getRidesWithCurrentData(park);

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

      // Get historical baseline for these rides
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

      return {
        level: crowdLevel,
        label: this.getCrowdLevelLabel(crowdLevel),
        ridesUsed: topRides.length,
        totalRides: ridesWithCurrentData.length,
        historicalBaseline: Math.round(historicalBaseline),
        currentAverage: Math.round(currentAverage),
        confidence,
        calculatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Error calculating crowd level for park ${park.id}:`,
        error,
      );
      return this.getDefaultCrowdLevel(0, 0, 'Calculation error');
    }
  }

  /**
   * Calculate crowd level for a park with timeout protection
   */
  async calculateCrowdLevelWithTimeout(
    park: ParkType,
    timeoutMs: number = 2000,
  ): Promise<CrowdLevel> {
    return new Promise(async (resolve) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.logger.warn(
          `Crowd level calculation timed out after ${timeoutMs}ms for park: ${park.name}`,
        );
        resolve(this.getDefaultCrowdLevel(0, 0, 'Calculation timeout'));
      }, timeoutMs);

      try {
        const result = await this.calculateCrowdLevel(park);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        this.logger.error(
          `Error calculating crowd level for park ${park.name}:`,
          error,
        );
        resolve(this.getDefaultCrowdLevel(0, 0, 'Calculation error'));
      }
    });
  }

  /**
   * Get rides with current queue time data
   */
  private getRidesWithCurrentData(park: ParkType): any[] {
    const allRides = this.parkUtils.getAllRidesFromPark(park);
    const ridesWithData = allRides.filter((ride) => {
      // Check if ride has currentQueueTime (transformed data) or queueTimes array (raw data)
      const currentQueueTime =
        (ride as any).currentQueueTime ||
        this.parkUtils.getCurrentQueueTime(ride);

      return (
        currentQueueTime &&
        currentQueueTime.isOpen &&
        currentQueueTime.waitTime !== null &&
        currentQueueTime.waitTime > 0
      );
    });

    return ridesWithData;
  }

  /**
   * Get current wait time for a ride
   */
  private getCurrentWaitTime(ride: any): number {
    // Handle both transformed data (currentQueueTime) and raw data (queueTimes array)
    const currentQueueTime =
      ride.currentQueueTime || this.parkUtils.getCurrentQueueTime(ride);
    return currentQueueTime?.waitTime || 0;
  }

  /**
   * Calculate average wait time for a list of rides
   */
  private calculateAverageWaitTime(rides: any[]): number {
    if (rides.length === 0) return 0;

    const totalWaitTime = rides.reduce((sum, ride) => {
      return sum + this.getCurrentWaitTime(ride);
    }, 0);

    return totalWaitTime / rides.length;
  }

  /**
   * Calculate historical baseline (95th percentile) for given rides over the last 2 years
   */
  private async calculateHistoricalBaseline(
    rideIds: number[],
  ): Promise<number> {
    if (rideIds.length === 0) return 0;

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
    if (!row || parseInt(row.count, 10) < this.MIN_DATA_POINTS) {
      return 0;
    }

    return parseFloat(row.percentile);
  }

  /**
   * Calculate confidence level based on available historical data coverage
   */
  private async calculateConfidence(rideIds: number[]): Promise<number> {
    if (rideIds.length === 0) return 0;

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

    if (!rangeRow || !rangeRow.firstDate || rangeRow.totalCount === '0') {
      return 10; // Minimum confidence when no data
    }
    const firstDataDate = new Date(rangeRow.firstDate);
    const lastDataDate = new Date(rangeRow.lastDate);
    const today = new Date();

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
    const confidence = Math.round(
      coveragePercentage * 0.7 + densityPercentage * 0.3,
    );

    return Math.max(10, Math.min(100, confidence)); // Between 10% and 100%
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
