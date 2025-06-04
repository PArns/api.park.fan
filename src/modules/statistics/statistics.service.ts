import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Park } from '../parks/park.entity.js';
import { ThemeArea } from '../parks/theme-area.entity.js';
import { Ride } from '../parks/ride.entity.js';
import { ParkUtilsService } from '../utils/park-utils.service.js';
import { WaitTimeDistribution, QueueTime } from '../utils/park-utils.types.js';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Park)
    private readonly parkRepository: Repository<Park>,
    @InjectRepository(ThemeArea)
    private readonly themeAreaRepository: Repository<ThemeArea>,
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
    private readonly configService: ConfigService,
    private readonly parkUtils: ParkUtilsService,
  ) {}

  /**
   * Get the default park open threshold from configuration
   */
  private getDefaultOpenThreshold(): number {
    return this.parkUtils.getDefaultOpenThreshold();
  }

  /**
   * Helper function to extract current queue time from a ride
   */
  private getCurrentQueueTime(ride: any) {
    return this.parkUtils.getCurrentQueueTime(ride);
  }

  /**
   * Helper function to calculate if a park is open based on the percentage of open rides
   */
  private calculateParkOpenStatus(park: any, openThreshold?: number): boolean {
    return this.parkUtils.calculateParkOpenStatus(park, openThreshold);
  }

  /**
   * Get comprehensive statistics
   */
  async getStatistics(openThreshold?: number) {
    const threshold = openThreshold ?? this.getDefaultOpenThreshold();
    const totalParks = await this.parkRepository.count();
    const totalThemeAreas = await this.themeAreaRepository.count();
    const totalRides = await this.rideRepository.count();

    // Get all parks with their rides and queue times for operating status calculation
    const allParks = await this.parkRepository
      .createQueryBuilder('park')
      .leftJoinAndSelect('park.themeAreas', 'themeAreas')
      .leftJoinAndSelect('themeAreas.rides', 'rides')
      .leftJoinAndSelect(
        'rides.queueTimes',
        'queueTimes',
        'queueTimes.lastUpdated = (SELECT MAX(qt."lastUpdated") FROM queue_time qt WHERE qt."rideId" = rides.id)',
      )
      .getMany();

    // Calculate park operating status
    const openParks = allParks.filter((park) =>
      this.calculateParkOpenStatus(park, threshold),
    );
    const openParksCount = openParks.length;
    const closedParksCount = totalParks - openParksCount;

    // Calculate park operating status by continent
    const parksByContinent = await this.calculateParkOperatingByContinent(
      allParks,
      threshold,
    );

    // Calculate park operating status by country (top 10)
    const parksByCountry = await this.calculateParkOperatingByCountry(
      allParks,
      threshold,
    );

    // Calculate ride statistics
    const rideStatistics = await this.calculateRideStatistics(
      allParks,
      threshold,
    );

    return {
      totalParks,
      totalThemeAreas,
      totalRides,
      parkOperatingStatus: {
        openParks: openParksCount,
        closedParks: closedParksCount,
        operatingPercentage: Math.round((openParksCount / totalParks) * 100),
        openThreshold: threshold,
      },
      rideStatistics,
      parksByContinent,
      parksByCountry,
    };
  }

  /**
   * Calculate park operating status by continent
   */
  private calculateParkOperatingByContinent(
    parks: any[],
    openThreshold?: number,
  ) {
    const threshold = openThreshold ?? this.getDefaultOpenThreshold();
    const continentStats = new Map();

    parks.forEach((park) => {
      const continent = park.continent;
      const isOpen = this.calculateParkOpenStatus(park, threshold);

      if (!continentStats.has(continent)) {
        continentStats.set(continent, { total: 0, open: 0 });
      }

      const stats = continentStats.get(continent);
      stats.total++;
      if (isOpen) stats.open++;
    });

    return Array.from(continentStats.entries())
      .map(([continent, stats]: [string, any]) => ({
        continent,
        totalParks: stats.total,
        openParks: stats.open,
        closedParks: stats.total - stats.open,
        operatingPercentage: Math.round((stats.open / stats.total) * 100),
      }))
      .sort((a, b) => b.totalParks - a.totalParks);
  }

  /**
   * Calculate park operating status by country (top 10)
   */
  private calculateParkOperatingByCountry(
    parks: any[],
    openThreshold?: number,
  ) {
    const threshold = openThreshold ?? this.getDefaultOpenThreshold();
    const countryStats = new Map();

    parks.forEach((park) => {
      const country = park.country;
      const isOpen = this.calculateParkOpenStatus(park, threshold);

      if (!countryStats.has(country)) {
        countryStats.set(country, { total: 0, open: 0 });
      }

      const stats = countryStats.get(country);
      stats.total++;
      if (isOpen) stats.open++;
    });

    return Array.from(countryStats.entries())
      .map(([country, stats]: [string, any]) => ({
        country,
        totalParks: stats.total,
        openParks: stats.open,
        closedParks: stats.total - stats.open,
        operatingPercentage: Math.round((stats.open / stats.total) * 100),
      }))
      .sort((a, b) => b.totalParks - a.totalParks)
      .slice(0, 10); // Top 10 countries by total parks
  }

  /**
   * Calculate comprehensive ride statistics
   */
  private calculateRideStatistics(parks: any[], openThreshold?: number) {
    const threshold = openThreshold ?? this.getDefaultOpenThreshold();
    let totalRides = 0;
    let activeRides = 0;
    let openRides = 0;
    let ridesWithQueueTimes = 0;
    const waitTimeDistribution = {
      '0-10': 0,
      '11-30': 0,
      '31-60': 0,
      '61-120': 0,
      '120+': 0,
    };

    // Get all rides from all parks
    const allRides = parks.flatMap((park) =>
      park.themeAreas.flatMap((themeArea: any) =>
        themeArea.rides.map((ride: any) => ({
          ...ride,
          park: {
            id: park.id,
            name: park.name,
            country: park.country,
            continent: park.continent,
          },
        })),
      ),
    );

    totalRides = allRides.length;

    // Calculate ride statistics
    allRides.forEach((ride) => {
      if (ride.isActive) activeRides++;

      const currentQueueTime = this.getCurrentQueueTime(ride);
      if (currentQueueTime) {
        ridesWithQueueTimes++;

        if (currentQueueTime.isOpen) {
          openRides++;

          // Categorize wait times
          const waitTime = currentQueueTime.waitTime;
          if (waitTime <= 10) waitTimeDistribution['0-10']++;
          else if (waitTime <= 30) waitTimeDistribution['11-30']++;
          else if (waitTime <= 60) waitTimeDistribution['31-60']++;
          else if (waitTime <= 120) waitTimeDistribution['61-120']++;
          else waitTimeDistribution['120+']++;
        }
      }
    });

    // Calculate ride statistics by continent
    const ridesByContinent = this.calculateRidesByContinent(parks);

    // Calculate ride statistics by country (top 10)
    const ridesByCountry = this.calculateRidesByCountry(parks);

    // Find rides with longest wait times (top 5)
    const longestWaitTimes = this.getLongestWaitTimes(allRides);

    // Find most popular rides (shortest wait times among open rides, top 5)
    const shortestWaitTimes = this.getShortestWaitTimes(allRides);

    // Find parks with highest average wait times (top 5)
    const busiestParks = this.getBusiestParks(parks, threshold);

    // Find parks with lowest average wait times (top 5)
    const quietestParks = this.getQuietestParks(parks, threshold);

    return {
      totalRides,
      activeRides,
      inactiveRides: totalRides - activeRides,
      openRides,
      closedRides: ridesWithQueueTimes - openRides,
      ridesWithoutData: totalRides - ridesWithQueueTimes,
      operatingPercentage:
        totalRides > 0 ? Math.round((openRides / totalRides) * 100) : 0,
      waitTimeDistribution,
      ridesByContinent,
      ridesByCountry,
      longestWaitTimes,
      shortestWaitTimes,
      busiestParks,
      quietestParks,
    };
  }

  /**
   * Calculate ride statistics by continent
   */
  private calculateRidesByContinent(parks: any[]) {
    const continentStats = new Map();

    parks.forEach((park) => {
      const continent = park.continent;

      if (!continentStats.has(continent)) {
        continentStats.set(continent, { total: 0, active: 0, open: 0 });
      }

      const stats = continentStats.get(continent);

      park.themeAreas.forEach((themeArea: any) => {
        themeArea.rides.forEach((ride: any) => {
          stats.total++;
          if (ride.isActive) stats.active++;

          const currentQueueTime = this.getCurrentQueueTime(ride);
          if (currentQueueTime && currentQueueTime.isOpen) {
            stats.open++;
          }
        });
      });
    });

    return Array.from(continentStats.entries())
      .map(([continent, stats]: [string, any]) => ({
        continent,
        totalRides: stats.total,
        activeRides: stats.active,
        openRides: stats.open,
        operatingPercentage:
          stats.total > 0 ? Math.round((stats.open / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.totalRides - a.totalRides);
  }

  /**
   * Calculate ride statistics by country (top 10)
   */
  private calculateRidesByCountry(parks: any[]) {
    const countryStats = new Map();

    parks.forEach((park) => {
      const country = park.country;

      if (!countryStats.has(country)) {
        countryStats.set(country, { total: 0, active: 0, open: 0 });
      }

      const stats = countryStats.get(country);

      park.themeAreas.forEach((themeArea: any) => {
        themeArea.rides.forEach((ride: any) => {
          stats.total++;
          if (ride.isActive) stats.active++;

          const currentQueueTime = this.getCurrentQueueTime(ride);
          if (currentQueueTime && currentQueueTime.isOpen) {
            stats.open++;
          }
        });
      });
    });

    return Array.from(countryStats.entries())
      .map(([country, stats]: [string, any]) => ({
        country,
        totalRides: stats.total,
        activeRides: stats.active,
        openRides: stats.open,
        operatingPercentage:
          stats.total > 0 ? Math.round((stats.open / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.totalRides - a.totalRides)
      .slice(0, 10);
  }

  /**
   * Get rides with longest wait times (top 5)
   */
  private getLongestWaitTimes(allRides: any[]) {
    return allRides
      .map((ride) => {
        const currentQueueTime = this.getCurrentQueueTime(ride);
        return {
          rideId: ride.id,
          rideName: ride.name,
          parkId: ride.park.id,
          parkName: ride.park.name,
          country: ride.park.country,
          waitTime: currentQueueTime ? currentQueueTime.waitTime : null,
          isOpen: currentQueueTime ? currentQueueTime.isOpen : false,
          lastUpdated: currentQueueTime ? currentQueueTime.lastUpdated : null,
        };
      })
      .filter((ride) => ride.isOpen && ride.waitTime !== null)
      .sort((a, b) => (b.waitTime || 0) - (a.waitTime || 0))
      .slice(0, 5);
  }

  /**
   * Get rides with shortest wait times among open rides (top 5)
   */
  private getShortestWaitTimes(allRides: any[]) {
    return allRides
      .map((ride) => {
        const currentQueueTime = this.getCurrentQueueTime(ride);
        return {
          rideId: ride.id,
          rideName: ride.name,
          parkId: ride.park.id,
          parkName: ride.park.name,
          country: ride.park.country,
          waitTime: currentQueueTime ? currentQueueTime.waitTime : null,
          isOpen: currentQueueTime ? currentQueueTime.isOpen : false,
          lastUpdated: currentQueueTime ? currentQueueTime.lastUpdated : null,
        };
      })
      .filter((ride) => ride.isOpen && ride.waitTime !== null)
      .sort((a, b) => (a.waitTime || 0) - (b.waitTime || 0))
      .slice(0, 5);
  }

  /**
   * Get parks with highest average wait times (busiest parks, top 5)
   * Only considers parks that are actually open (using park operating status logic)
   * Filters out rides with wait times <= 0 to ensure accurate statistics
   */
  private getBusiestParks(parks: any[], openThreshold?: number) {
    const threshold = openThreshold ?? this.getDefaultOpenThreshold();

    return parks
      .filter((park) => this.calculateParkOpenStatus(park, threshold)) // Use provided threshold
      .map((park) => {
        const allRides = park.themeAreas.flatMap(
          (themeArea: any) => themeArea.rides,
        );

        // All open rides (for count and percentage) - match the logic in calculateParkOpenStatus
        const allOpenRides = allRides.filter((ride: any) => {
          const currentQueueTime = this.getCurrentQueueTime(ride);
          return currentQueueTime && currentQueueTime.isOpen;
        });

        // Rides with waitTime data (for counting statistics)
        const ridesWithData = allOpenRides.filter((ride: any) => {
          const currentQueueTime = this.getCurrentQueueTime(ride);
          return currentQueueTime && currentQueueTime.waitTime !== null;
        });

        // Only rides with meaningful wait times (> 0) for average calculation
        const ridesWithWaitTime = ridesWithData.filter((ride: any) => {
          const currentQueueTime = this.getCurrentQueueTime(ride);
          return currentQueueTime && currentQueueTime.waitTime > 0;
        });

        if (ridesWithWaitTime.length === 0) {
          return null; // Skip parks with no open rides with wait time data
        }

        const totalWaitTime = ridesWithWaitTime.reduce(
          (sum: number, ride: any) => {
            const currentQueueTime = this.getCurrentQueueTime(ride);
            return sum + (currentQueueTime?.waitTime || 0);
          },
          0,
        );

        const averageWaitTime = Math.round(
          totalWaitTime / ridesWithWaitTime.length,
        );

        return {
          parkId: park.id,
          parkName: park.name,
          country: park.country,
          continent: park.continent,
          averageWaitTime,
          openRideCount: allOpenRides.length,
          totalRideCount: allRides.length,
          operatingPercentage: Math.round(
            (allOpenRides.length / allRides.length) * 100,
          ),
        };
      })
      .filter((park) => park !== null)
      .sort((a, b) => b.averageWaitTime - a.averageWaitTime)
      .slice(0, 5);
  }

  /**
   * Get parks with lowest average wait times (quietest parks, top 5)
   * Only considers parks that are actually open (using park operating status logic)
   * Filters out rides with wait times <= 0 to ensure accurate statistics
   */
  private getQuietestParks(parks: any[], openThreshold?: number) {
    const threshold = openThreshold ?? this.getDefaultOpenThreshold();

    return parks
      .filter((park) => this.calculateParkOpenStatus(park, threshold)) // Use provided threshold
      .map((park) => {
        const allRides = park.themeAreas.flatMap(
          (themeArea: any) => themeArea.rides,
        );

        // All open rides (for count and percentage) - match the logic in calculateParkOpenStatus
        const allOpenRides = allRides.filter((ride: any) => {
          const currentQueueTime = this.getCurrentQueueTime(ride);
          return currentQueueTime && currentQueueTime.isOpen;
        });

        // Rides with waitTime data (for counting statistics)
        const ridesWithData = allOpenRides.filter((ride: any) => {
          const currentQueueTime = this.getCurrentQueueTime(ride);
          return currentQueueTime && currentQueueTime.waitTime !== null;
        });

        // Only rides with meaningful wait times (> 0) for average calculation
        const ridesWithWaitTime = ridesWithData.filter((ride: any) => {
          const currentQueueTime = this.getCurrentQueueTime(ride);
          return currentQueueTime && currentQueueTime.waitTime > 0;
        });

        if (ridesWithWaitTime.length === 0) {
          return null; // Skip parks with no open rides with wait time data
        }

        const totalWaitTime = ridesWithWaitTime.reduce(
          (sum: number, ride: any) => {
            const currentQueueTime = this.getCurrentQueueTime(ride);
            return sum + (currentQueueTime?.waitTime || 0);
          },
          0,
        );

        const averageWaitTime = Math.round(
          totalWaitTime / ridesWithWaitTime.length,
        );

        return {
          parkId: park.id,
          parkName: park.name,
          country: park.country,
          continent: park.continent,
          averageWaitTime,
          openRideCount: allOpenRides.length,
          totalRideCount: allRides.length,
          operatingPercentage: Math.round(
            (allOpenRides.length / allRides.length) * 100,
          ),
        };
      })
      .filter((park) => park !== null)
      .sort((a, b) => a.averageWaitTime - b.averageWaitTime)
      .slice(0, 5);
  }
}
