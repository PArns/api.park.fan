import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { RidesService } from './rides.service.js';
import { RideQueryDto } from './rides.dto.js';

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Get()
  async findAll(@Query() query: RideQueryDto) {
    return this.ridesService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ridesService.findOne(id);
  }
}
