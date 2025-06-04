import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Park,
  Ride,
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
  constructor(private readonly configService: ConfigService) {}

  /**
   * Get the default park open threshold from configuration
   * @returns Percentage threshold for considering a park "open" (default: 50)
   */
  getDefaultOpenThreshold(): number {
    return this.configService.get<number>('PARK_OPEN_THRESHOLD_PERCENT', 50);
  }
  /**
   * Helper function to extract current queue time from a ride
   * @param ride Ride object with queueTimes array
   * @returns Current queue time information or null if not available
   */
  getCurrentQueueTime(ride: Ride): QueueTime | null {
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
   * @param park Park object with themeAreas containing rides
   * @param openThreshold Optional percentage threshold (0-100)
   * @returns Boolean indicating if the park is considered "open"
   */
  calculateParkOpenStatus(park: Park, openThreshold?: number): boolean {
    const threshold = openThreshold ?? this.getDefaultOpenThreshold();

    // Get all rides from all theme areas
    const allRides = park.themeAreas.flatMap((themeArea) => themeArea.rides);
    const totalRideCount = allRides.length;

    if (totalRideCount === 0) {
      return false;
    }

    // Count rides that are currently open (have queue time data and isOpen = true)
    const openRideCount = allRides.filter((ride) => {
      const currentQueueTime = this.getCurrentQueueTime(ride);
      return currentQueueTime && currentQueueTime.isOpen;
    }).length;

    const operatingPercentage = Math.round(
      (openRideCount / totalRideCount) * 100,
    );
    return operatingPercentage >= threshold;
  }
  /**
   * Helper function to get detailed park open status with additional metrics
   * @param park Park object with themeAreas containing rides
   * @param openThreshold Optional percentage threshold (0-100)
   * @returns Detailed operating status including counts and percentages
   */
  getDetailedParkOpenStatus(
    park: Park,
    openThreshold?: number,
  ): ParkOperatingStatus {
    const threshold = openThreshold ?? this.getDefaultOpenThreshold();

    // Get all rides from all theme areas
    const allRides = park.themeAreas.flatMap((themeArea) => themeArea.rides);
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
    const openRideCount = allRides.filter((ride) => {
      const currentQueueTime = this.getCurrentQueueTime(ride);
      return currentQueueTime && currentQueueTime.isOpen;
    }).length;

    const operatingPercentage = Math.round(
      (openRideCount / totalRideCount) * 100,
    );
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
   * @param park Park object with themeAreas containing rides
   * @returns Wait time distribution object with counts for each time range
   */
  calculateWaitTimeDistribution(park: Park): WaitTimeDistribution {
    const waitTimeDistribution: WaitTimeDistribution = {
      '0-10': 0,
      '11-30': 0,
      '31-60': 0,
      '61-120': 0,
      '120+': 0,
    };

    // Get all rides from all theme areas
    const allRides = park.themeAreas.flatMap((themeArea) => themeArea.rides);

    // Calculate wait time distribution
    allRides.forEach((ride) => {
      const currentQueueTime = this.getCurrentQueueTime(ride);
      if (
        currentQueueTime &&
        currentQueueTime.isOpen &&
        currentQueueTime.waitTime !== null
      ) {
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
}
