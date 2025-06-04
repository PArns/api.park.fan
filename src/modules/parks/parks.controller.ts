import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ParksService } from './parks.service.js';
import { ParkQueryDto } from './parks.dto.js';

@Controller('parks')
export class ParksController {
  constructor(private readonly parksService: ParksService) {}

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
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<any> {
    return this.parksService.findOne(id);
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
