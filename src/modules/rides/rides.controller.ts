import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { RidesService } from './rides.service.js';
import { RideQueryDto } from './rides.dto.js';
import { HierarchicalUrlInjectorService } from '../utils/hierarchical-url-injector.service.js';

@Controller('rides')
export class RidesController {
  constructor(
    private readonly ridesService: RidesService,
    private readonly urlInjector: HierarchicalUrlInjectorService,
  ) {}

  @Get()
  async findAll(@Query() query: RideQueryDto) {
    const rides = await this.ridesService.findAll(query);

    // Add hierarchical URLs to each ride using the injector
    return {
      ...rides,
      data: this.urlInjector.addUrlsToRides(rides.data),
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const ride = await this.ridesService.findOne(id);

    // Add hierarchical URLs to the response using the injector
    return this.urlInjector.addUrlToRide(ride);
  }
}
