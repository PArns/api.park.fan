import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StatisticsService } from './statistics.service.js';

@Controller('statistics')
export class StatisticsController {
  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async getStatistics(@Query('openThreshold') openThreshold?: string) {
    const defaultThreshold = this.configService.get<number>('PARK_OPEN_THRESHOLD_PERCENT', 50);
    const threshold = openThreshold ? parseInt(openThreshold) || defaultThreshold : defaultThreshold;
    // Ensure threshold is between 0 and 100
    const validThreshold = Math.min(Math.max(threshold, 0), 100);
    return this.statisticsService.getStatistics(validThreshold);
  }
}
