import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StatisticsService } from './statistics.service.js';
import { StatisticsQueryDto } from './statistics.dto';

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
    return this.statisticsService.getStatistics(validThreshold);
  }
}
