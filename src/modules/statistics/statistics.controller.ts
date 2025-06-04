import { Controller, Get, Query } from '@nestjs/common';
import { StatisticsService } from './statistics.service.js';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  async getStatistics(@Query('openThreshold') openThreshold: string = '50') {
    const threshold = parseInt(openThreshold) || 50;
    // Ensure threshold is between 0 and 100
    const validThreshold = Math.min(Math.max(threshold, 0), 100);
    return this.statisticsService.getStatistics(validThreshold);
  }
}
