import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParksService } from './parks.service.js';
import { ParkQueryDto } from './parks.dto.js';

@Controller('parks')
export class ParksController {
  constructor(
    private readonly parksService: ParksService,
    private readonly configService: ConfigService,
  ) {}

  // Readonly API endpoints for parks
  @Get()
  async findAll(@Query() query: ParkQueryDto): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return this.parksService.findAll(query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ParkQueryDto,
  ): Promise<any> {
    const defaultThreshold = this.configService.get<number>('PARK_OPEN_THRESHOLD_PERCENT', 50);
    const threshold = query.openThreshold ?? defaultThreshold;
    // Ensure threshold is between 0 and 100
    const validThreshold = Math.min(Math.max(threshold, 0), 100);
    return this.parksService.findOne(id, validThreshold);
  }

  @Get(':id/rides')
  async findParkRides(@Param('id', ParseIntPipe) id: number): Promise<{
    parkId: number;
    parkName: string;
    rides: any[];
  }> {
    return this.parksService.findParkRides(id);
  }
}
