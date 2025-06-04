import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Park } from '../parks/park.entity.js';

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Park)
    private readonly parkRepository: Repository<Park>,
  ) {}

  /**
   * Get all countries that have parks
   */
  async getCountries(): Promise<string[]> {
    const result = await this.parkRepository
      .createQueryBuilder('park')
      .select('DISTINCT park.country', 'country')
      .orderBy('park.country', 'ASC')
      .getRawMany();

    return result
      .map((item: { country: string }) => item.country)
      .filter(Boolean);
  }
}
