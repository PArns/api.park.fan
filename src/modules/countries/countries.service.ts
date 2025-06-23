import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Park } from '../parks/park.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Park)
    private readonly parkRepository: Repository<Park>,
    private readonly configService: ConfigService,
  ) {}

  private cache: { value: string[]; timestamp: number } | null = null;
  private continentCache = new Map<
    string,
    { value: string[]; timestamp: number }
  >();
  private get CACHE_TTL() {
    const seconds = this.configService.get<number>('CACHE_TTL_SECONDS', 3600);
    return seconds * 1000;
  }

  /**
   * Get all countries that have parks
   */
  async getCountries(): Promise<string[]> {
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.value;
    }

    const result = await this.parkRepository
      .createQueryBuilder('park')
      .select('DISTINCT park.country', 'country')
      .orderBy('park.country', 'ASC')
      .getRawMany();

    const countries = result
      .map((item: { country: string }) => item.country)
      .filter(Boolean);

    this.cache = { value: countries, timestamp: Date.now() };

    return countries;
  }

  /**
   * Get countries within a specific continent
   */
  async getCountriesByContinent(continent: string): Promise<string[]> {
    const cached = this.continentCache.get(continent.toLowerCase());
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.value;
    }

    const result = await this.parkRepository
      .createQueryBuilder('park')
      .select('DISTINCT park.country', 'country')
      .where('LOWER(park.continent) = LOWER(:continent)', { continent })
      .orderBy('park.country', 'ASC')
      .getRawMany();

    const countries = result
      .map((item: { country: string }) => item.country)
      .filter(Boolean);

    this.continentCache.set(continent.toLowerCase(), {
      value: countries,
      timestamp: Date.now(),
    });

    return countries;
  }
}
