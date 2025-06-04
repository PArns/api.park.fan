import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Park } from '../parks/park.entity.js';
import { ThemeArea } from '../parks/theme-area.entity.js';
import { Ride } from '../parks/ride.entity.js';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Park)
    private readonly parkRepository: Repository<Park>,
    @InjectRepository(ThemeArea)
    private readonly themeAreaRepository: Repository<ThemeArea>,
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
  ) {}

  /**
   * Get comprehensive statistics
   */
  async getStatistics() {
    const totalParks = await this.parkRepository.count();
    const totalThemeAreas = await this.themeAreaRepository.count();
    const totalRides = await this.rideRepository.count();

    const parksByCountry = await this.parkRepository
      .createQueryBuilder('park')
      .select('park.country', 'country')
      .addSelect('COUNT(park.id)', 'count')
      .groupBy('park.country')
      .orderBy('count', 'DESC')
      .getRawMany();

    const parksByContinent = await this.parkRepository
      .createQueryBuilder('park')
      .select('park.continent', 'continent')
      .addSelect('COUNT(park.id)', 'count')
      .groupBy('park.continent')
      .orderBy('count', 'DESC')
      .getRawMany();

    return {
      totalParks,
      totalThemeAreas,
      totalRides,
      parksByCountry: parksByCountry.map(
        (item: { country: string; count: string }) => ({
          country: item.country,
          count: parseInt(item.count),
        }),
      ),
      parksByContinent: parksByContinent.map(
        (item: { continent: string; count: string }) => ({
          continent: item.continent,
          count: parseInt(item.count),
        }),
      ),
    };
  }
}
