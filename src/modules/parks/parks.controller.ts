import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParksService } from './parks.service.js';
import { WeatherService } from './weather.service.js';
import { ParkQueryDto } from './parks.dto.js';
import { RidesService } from '../rides/rides.service.js';
import { HierarchicalUrlService } from '../utils/hierarchical-url.service.js';
import { HierarchicalUrlInjectorService } from '../utils/hierarchical-url-injector.service.js';
import { WEATHER_CACHE_SERVICE } from './weather-cache.interface.js';
import { WeatherCacheService } from './weather-cache.interface.js';

@Controller('parks')
export class ParksController {
  private readonly logger = new Logger(ParksController.name);

  constructor(
    private readonly parksService: ParksService,
    private readonly weatherService: WeatherService,
    private readonly ridesService: RidesService,
    private readonly configService: ConfigService,
    private readonly urlInjector: HierarchicalUrlInjectorService,
    @Inject(WEATHER_CACHE_SERVICE)
    private readonly weatherCache: WeatherCacheService,
  ) {}

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

    // Add hierarchical URLs to each park using the injector
    const parksWithUrls = {
      ...parks,
      data: this.urlInjector.addUrlsToParks(parks.data),
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
      const includeWeather = query.includeWeather ?? true;
      const park = await this.parksService.findOne(
        id,
        validThreshold,
        includeCrowdLevel,
        includeWeather,
      );

      // Add hierarchical URL to the response using the injector
      return this.urlInjector.addUrlToPark({
        ...park,
      });
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

    // Add hierarchical URLs to each park using the injector
    const parksWithUrls = {
      ...parks,
      data: this.urlInjector.addUrlsToParks(parks.data),
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

    // Add hierarchical URLs to each park using the injector
    const parksWithUrls = {
      ...parks,
      data: this.urlInjector.addUrlsToParks(parks.data),
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
    // Use optimized database query instead of loading all parks
    const matchingPark = await this.parksService.findParkByHierarchy(
      continentSlug,
      countrySlug,
      parkSlug,
    );

    if (!matchingPark) {
      throw new NotFoundException(
        `Park not found for path: ${continentSlug}/${countrySlug}/${parkSlug}`,
      );
    }

    // Get query parameters
    const defaultThreshold = this.configService.get<number>(
      'PARK_OPEN_THRESHOLD_PERCENT',
      50,
    );
    const threshold = query.openThreshold ?? defaultThreshold;
    const validThreshold = Math.min(Math.max(threshold, 0), 100);
    const includeCrowdLevel = query.includeCrowdLevel ?? true;
    const includeWeather = query.includeWeather ?? true;

    // Transform the park data directly since we already have all relations loaded
    let weatherDataMap = new Map<number, any>();
    if (includeWeather) {
      try {
        const parkIds = [matchingPark.id];

        weatherDataMap =
          await this.weatherService.getBatchCompleteWeatherForParks(parkIds);
      } catch (error) {
        this.logger.warn(
          'Error retrieving weather data for hierarchical park:',
          error,
        );
        // Continue without weather data if fails
      }
    }

    // Transform the data using helper functions
    const parkDetails = await this.parksService.transformParkWithWeatherData(
      matchingPark,
      weatherDataMap,
      validThreshold,
      includeCrowdLevel,
      includeWeather,
    );

    // Add hierarchical URL to the response using the injector with URL context as fallback
    const urlContext = {
      continent: continentSlug.replace(/-/g, ' '),
      country: countrySlug.replace(/-/g, ' '),
      name: parkSlug.replace(/-/g, ' '),
    };

    return this.urlInjector.addUrlToParkWithDetailsAndContext(
      parkDetails,
      urlContext,
    );
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
    // Use optimized database query to find the park
    const matchingPark = await this.parksService.findParkByHierarchy(
      continentSlug,
      countrySlug,
      parkSlug,
    );

    if (!matchingPark) {
      throw new NotFoundException(
        `Park not found for path: ${continentSlug}/${countrySlug}/${parkSlug}`,
      );
    }

    // Use optimized database query to find the ride
    const matchingRide = await this.parksService.findRideByParkAndName(
      matchingPark.id,
      rideSlug,
    );

    if (!matchingRide) {
      throw new NotFoundException(
        `Ride not found for path: ${continentSlug}/${countrySlug}/${parkSlug}/${rideSlug}`,
      );
    }

    // Return detailed ride information with URLs using the injector
    const rideDetails = await this.ridesService.findOne(matchingRide.id);

    // Create URL context for the ride
    const urlContext = {
      continent: continentSlug.replace(/-/g, ' '),
      country: countrySlug.replace(/-/g, ' '),
      name: parkSlug.replace(/-/g, ' '),
    };

    return this.urlInjector.addUrlToRide(rideDetails, urlContext);
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
