import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StatisticsService } from './statistics.service.js';
import { StatisticsQueryDto } from './statistics.dto';
import { HierarchicalUrlInjectorService } from '../utils/hierarchical-url-injector.service.js';

@Controller('statistics')
export class StatisticsController {
  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly configService: ConfigService,
    private readonly urlInjector: HierarchicalUrlInjectorService,
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
    const statistics =
      await this.statisticsService.getStatistics(validThreshold);

    // Add hierarchical URLs using the injector service
    const rideStatisticsWithUrls = {
      ...statistics.rideStatistics,
      busiestParks: this.urlInjector.addUrlsToParkStatistics(
        statistics.rideStatistics.busiestParks,
      ),
      quietestParks: this.urlInjector.addUrlsToParkStatistics(
        statistics.rideStatistics.quietestParks,
      ),
      longestWaitTimes: this.urlInjector.addUrlsToRideStatistics(
        statistics.rideStatistics.longestWaitTimes,
      ),
      shortestWaitTimes: this.urlInjector.addUrlsToRideStatistics(
        statistics.rideStatistics.shortestWaitTimes,
      ),
    };

    return {
      ...statistics,
      rideStatistics: rideStatisticsWithUrls,
    };
  }
}
