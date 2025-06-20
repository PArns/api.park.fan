import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StatisticsService } from './statistics.service.js';
import { StatisticsQueryDto } from './statistics.dto';
import { HierarchicalUrlService } from '../utils/hierarchical-url.service.js';

@Controller('statistics')
export class StatisticsController {
  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async getStatistics(@Query() query: StatisticsQueryDto) {
    const defaultThreshold = this.configService.get<number>(
      'PARK_OPEN_THRESHOLD_PERCENT',
      50,
    );
    const threshold = query.openThreshold ?? defaultThreshold;
    // Ensure threshold is between 0 and 100
    const validThreshold = Math.min(Math.max(threshold, 0), 100);
    const statistics = await this.statisticsService.getStatistics(validThreshold);
    
    // Add hierarchical URLs to busiest and quietest parks, and longest/shortest wait times
    const rideStatisticsWithUrls = {
      ...statistics.rideStatistics,
      busiestParks: statistics.rideStatistics.busiestParks?.map((park: any) => ({
        ...park,
        hierarchicalUrl: HierarchicalUrlService.generateParkUrl(
          park.continent,
          park.country,
          park.parkName,
        ),
      })),
      quietestParks: statistics.rideStatistics.quietestParks?.map((park: any) => ({
        ...park,
        hierarchicalUrl: HierarchicalUrlService.generateParkUrl(
          park.continent,
          park.country,
          park.parkName,
        ),
      })),
      longestWaitTimes: statistics.rideStatistics.longestWaitTimes?.map((ride: any) => ({
        ...ride,
        hierarchicalUrl: HierarchicalUrlService.generateRideUrl(
          ride.park.continent,
          ride.park.country,
          ride.park.name,
          ride.name,
        ),
        park: {
          ...ride.park,
          hierarchicalUrl: HierarchicalUrlService.generateParkUrl(
            ride.park.continent,
            ride.park.country,
            ride.park.name,
          ),
        },
      })),
      shortestWaitTimes: statistics.rideStatistics.shortestWaitTimes?.map((ride: any) => ({
        ...ride,
        hierarchicalUrl: HierarchicalUrlService.generateRideUrl(
          ride.park.continent,
          ride.park.country,
          ride.park.name,
          ride.name,
        ),
        park: {
          ...ride.park,
          hierarchicalUrl: HierarchicalUrlService.generateParkUrl(
            ride.park.continent,
            ride.park.country,
            ride.park.name,
          ),
        },
      })),
    };

    return {
      ...statistics,
      rideStatistics: rideStatisticsWithUrls,
    };
  }
}
