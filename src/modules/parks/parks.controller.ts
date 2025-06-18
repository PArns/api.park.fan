import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParksService } from './parks.service.js';
import { ParkQueryDto } from './parks.dto.js';
import { RidesService } from '../rides/rides.service.js';
import { HierarchicalUrlService } from '../utils/hierarchical-url.service.js';

@Controller('parks')
export class ParksController {
  constructor(
    private readonly parksService: ParksService,
    private readonly ridesService: RidesService,
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
    const parks = await this.parksService.findAll(query);

    // Add hierarchical URLs to each park
    const parksWithUrls = {
      ...parks,
      data: parks.data.map((park) => ({
        ...park,
        hierarchicalUrl: HierarchicalUrlService.generateParkUrl(
          park.continent,
          park.country,
          park.name,
        ),
      })),
    };

    return parksWithUrls;
  }

  // Hierarchical routes - they handle both string continents and numeric IDs

  /**
   * Get all parks in a specific continent OR specific park by ID: /parks/continent or /parks/:id
   */
  @Get(':continent')
  async findParksByContinent(
    @Param('continent') continentSlug: string,
    @Query() query: ParkQueryDto,
  ): Promise<any> {
    // Check if the parameter is numeric (handle as ID)
    if (/^\d+$/.test(continentSlug)) {
      const id = parseInt(continentSlug, 10);
      const defaultThreshold = this.configService.get<number>(
        'PARK_OPEN_THRESHOLD_PERCENT',
        50,
      );
      const threshold = query.openThreshold ?? defaultThreshold;
      const validThreshold = Math.min(Math.max(threshold, 0), 100);
      const includeCrowdLevel = query.includeCrowdLevel ?? true;
      const park = await this.parksService.findOne(
        id,
        validThreshold,
        includeCrowdLevel,
      );

      // Add hierarchical URL to the response
      return {
        ...park,
        hierarchicalUrl: HierarchicalUrlService.generateParkUrl(
          park.continent,
          park.country,
          park.name,
        ),
      };
    }

    const continentVariations = HierarchicalUrlService.fromSlug(continentSlug);

    // Find continent match
    const continent = await this.findMatchingContinent(continentVariations);
    if (!continent) {
      throw new NotFoundException(`Continent not found: ${continentSlug}`);
    }

    // Get parks for this continent
    const parks = await this.parksService.findAll({
      ...query,
      continent: continent,
      limit: query.limit || 50,
    });

    // Add hierarchical URLs to each park
    const parksWithUrls = {
      ...parks,
      data: parks.data.map((park) => ({
        ...park,
        hierarchicalUrl: HierarchicalUrlService.generateParkUrl(
          park.continent,
          park.country,
          park.name,
        ),
      })),
    };

    return parksWithUrls;
  }

  /**
   * Get all parks in a specific country: /parks/continent/country
   */
  @Get(':continent/:country')
  async findParksByCountry(
    @Param('continent') continentSlug: string,
    @Param('country') countrySlug: string,
    @Query() query: ParkQueryDto,
  ): Promise<any> {
    const continentVariations = HierarchicalUrlService.fromSlug(continentSlug);
    const countryVariations = HierarchicalUrlService.fromSlug(countrySlug);

    // Find continent and country matches
    const continent = await this.findMatchingContinent(continentVariations);
    const country = await this.findMatchingCountry(
      countryVariations,
      continent,
    );

    if (!continent || !country) {
      throw new NotFoundException(
        `Location not found: ${continentSlug}/${countrySlug}`,
      );
    }

    // Get parks for this country
    const parks = await this.parksService.findAll({
      ...query,
      continent: continent,
      country: country,
      limit: query.limit || 50,
    });

    // Add hierarchical URLs to each park
    const parksWithUrls = {
      ...parks,
      data: parks.data.map((park) => ({
        ...park,
        hierarchicalUrl: HierarchicalUrlService.generateParkUrl(
          park.continent,
          park.country,
          park.name,
        ),
      })),
    };

    return parksWithUrls;
  }

  /**
   * Get park by hierarchical route: /parks/continent/country/park
   */
  @Get(':continent/:country/:park')
  async findParkByHierarchy(
    @Param('continent') continentSlug: string,
    @Param('country') countrySlug: string,
    @Param('park') parkSlug: string,
    @Query() query: ParkQueryDto,
  ): Promise<any> {
    // Convert slugs back to possible original names
    const continentVariations = HierarchicalUrlService.fromSlug(continentSlug);
    const countryVariations = HierarchicalUrlService.fromSlug(countrySlug);
    const parkVariations = HierarchicalUrlService.fromSlug(parkSlug);

    // Find all parks first
    const allParks = await this.parksService.findAll({ limit: 1000 });

    // Find matching park
    const matchingPark = allParks.data.find((park) => {
      const continentMatch = continentVariations.some(
        (variation) => park.continent.toLowerCase() === variation.toLowerCase(),
      );
      const countryMatch = countryVariations.some(
        (variation) => park.country.toLowerCase() === variation.toLowerCase(),
      );
      const parkMatch = parkVariations.some(
        (variation) => park.name.toLowerCase() === variation.toLowerCase(),
      );
      return continentMatch && countryMatch && parkMatch;
    });

    if (!matchingPark) {
      throw new NotFoundException(
        `Park not found for path: ${continentSlug}/${countrySlug}/${parkSlug}`,
      );
    }

    // Get detailed park information
    const defaultThreshold = this.configService.get<number>(
      'PARK_OPEN_THRESHOLD_PERCENT',
      50,
    );
    const threshold = query.openThreshold ?? defaultThreshold;
    const validThreshold = Math.min(Math.max(threshold, 0), 100);
    const includeCrowdLevel = query.includeCrowdLevel ?? true;

    const parkDetails = await this.parksService.findOne(
      matchingPark.id,
      validThreshold,
      includeCrowdLevel,
    );

    // Add hierarchical URL to the response
    const hierarchicalUrl = HierarchicalUrlService.generateParkUrl(
      parkDetails.continent,
      parkDetails.country,
      parkDetails.name,
    );

    return {
      ...parkDetails,
      hierarchicalUrl,
    };
  }

  /**
   * Get ride by hierarchical route: /parks/continent/country/park/ride
   */
  @Get(':continent/:country/:park/:ride')
  async findRideByHierarchy(
    @Param('continent') continentSlug: string,
    @Param('country') countrySlug: string,
    @Param('park') parkSlug: string,
    @Param('ride') rideSlug: string,
  ): Promise<any> {
    // First find the park using the same logic as above
    const continentVariations = HierarchicalUrlService.fromSlug(continentSlug);
    const countryVariations = HierarchicalUrlService.fromSlug(countrySlug);
    const parkVariations = HierarchicalUrlService.fromSlug(parkSlug);
    const rideVariations = HierarchicalUrlService.fromSlug(rideSlug);

    // Find all parks first
    const allParks = await this.parksService.findAll({ limit: 1000 });

    // Find matching park
    const matchingPark = allParks.data.find((park) => {
      const continentMatch = continentVariations.some(
        (variation) => park.continent.toLowerCase() === variation.toLowerCase(),
      );
      const countryMatch = countryVariations.some(
        (variation) => park.country.toLowerCase() === variation.toLowerCase(),
      );
      const parkMatch = parkVariations.some(
        (variation) => park.name.toLowerCase() === variation.toLowerCase(),
      );

      return continentMatch && countryMatch && parkMatch;
    });

    if (!matchingPark) {
      throw new NotFoundException(
        `Park not found for path: ${continentSlug}/${countrySlug}/${parkSlug}`,
      );
    }

    // Get all rides for this park
    const parkRides = await this.parksService.findParkRides(matchingPark.id);

    // Find matching ride
    const matchingRide = parkRides.rides.find((ride) => {
      return rideVariations.some(
        (variation) => ride.name.toLowerCase() === variation.toLowerCase(),
      );
    });

    if (!matchingRide) {
      throw new NotFoundException(
        `Ride not found for path: ${continentSlug}/${countrySlug}/${parkSlug}/${rideSlug}`,
      );
    }

    // Return detailed ride information
    const rideDetails = await this.ridesService.findOne(matchingRide.id);

    // Add hierarchical URLs to the response
    const rideHierarchicalUrl = HierarchicalUrlService.generateRideUrl(
      rideDetails.park.continent,
      rideDetails.park.country,
      rideDetails.park.name,
      rideDetails.name,
    );

    const parkHierarchicalUrl = HierarchicalUrlService.generateParkUrl(
      rideDetails.park.continent,
      rideDetails.park.country,
      rideDetails.park.name,
    );

    return {
      ...rideDetails,
      hierarchicalUrl: rideHierarchicalUrl,
      park: {
        ...rideDetails.park,
        hierarchicalUrl: parkHierarchicalUrl,
      },
    };
  }

  // Specific ID routes
  @Get(':id/rides')
  async findParkRides(@Param('id', ParseIntPipe) id: number): Promise<{
    parkId: number;
    parkName: string;
    rides: any[];
  }> {
    return this.parksService.findParkRides(id);
  }

  /**
   * Helper method to find matching continent from variations
   */
  private async findMatchingContinent(
    continentVariations: string[],
  ): Promise<string | null> {
    const allParks = await this.parksService.findAll({ limit: 1000 });
    const continents = [
      ...new Set(allParks.data.map((park) => park.continent)),
    ];

    return (
      continents.find((continent) =>
        continentVariations.some(
          (variation) => continent.toLowerCase() === variation.toLowerCase(),
        ),
      ) || null
    );
  }

  /**
   * Helper method to find matching country from variations
   */
  private async findMatchingCountry(
    countryVariations: string[],
    continent?: string | null,
  ): Promise<string | null> {
    const query: any = { limit: 1000 };
    if (continent) {
      query.continent = continent;
    }

    const allParks = await this.parksService.findAll(query);
    const countries = [...new Set(allParks.data.map((park) => park.country))];

    return (
      countries.find((country) =>
        countryVariations.some(
          (variation) => country.toLowerCase() === variation.toLowerCase(),
        ),
      ) || null
    );
  }
}
