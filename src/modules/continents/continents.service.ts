import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Park } from '../parks/park.entity.js';

@Injectable()
export class ContinentsService {
  constructor(
    @InjectRepository(Park)
    private readonly parkRepository: Repository<Park>,
  ) {}

  /**
   * Get all continents that have parks
   */
  async getContinents(): Promise<string[]> {
    const result = await this.parkRepository
      .createQueryBuilder('park')
      .select('DISTINCT park.continent', 'continent')
      .orderBy('park.continent', 'ASC')
      .getRawMany();

    return result
      .map((item: { continent: string }) => item.continent)
      .filter(Boolean);
  }
}
