import { Controller, Get } from '@nestjs/common';
import { StatusService } from './status.service';
import { CacheService } from '../utils/cache.service';

@Controller('status')
export class StatusController {
  constructor(
    private readonly statusService: StatusService,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  getStatus(): { status: string } {
    return this.statusService.getStatus();
  }

  @Get('cache')
  getCacheStats() {
    return this.cacheService.getStats();
  }
}
