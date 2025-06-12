import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { RidesService } from './rides.service.js';
import { RideQueryDto } from './rides.dto.js';
import { HierarchicalUrlService } from '../utils/hierarchical-url.service.js';

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Get()
  async findAll(@Query() query: RideQueryDto) {
    const rides = await this.ridesService.findAll(query);

    // Add hierarchical URLs to each ride
    return {
      ...rides,
      data: rides.data.map((ride) => ({
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
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const ride = await this.ridesService.findOne(id);

    // Add hierarchical URLs to the response
    const rideHierarchicalUrl = HierarchicalUrlService.generateRideUrl(
      ride.park.continent,
      ride.park.country,
      ride.park.name,
      ride.name,
    );

    const parkHierarchicalUrl = HierarchicalUrlService.generateParkUrl(
      ride.park.continent,
      ride.park.country,
      ride.park.name,
    );

    return {
      ...ride,
      hierarchicalUrl: rideHierarchicalUrl,
      park: {
        ...ride.park,
        hierarchicalUrl: parkHierarchicalUrl,
      },
    };
  }
}
