import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Park } from '../parks/park.entity';

@Injectable()
export class ContinentsService {
  constructor(
    @InjectRepository(Park)
    private readonly parkRepository: Repository<Park>,
    private readonly configService: ConfigService,
  ) {}

  private cache: { value: string[]; timestamp: number } | null = null;

  private get CACHE_TTL() {
    const seconds = this.configService.get<number>('CACHE_TTL_SECONDS', 3600);
    return seconds * 1000;
  }

  /**
   * Get all continents that have parks
   */
  async getContinents(): Promise<string[]> {
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.value;
    }

    const result = await this.parkRepository
      .createQueryBuilder('park')
      .select('DISTINCT park.continent', 'continent')
      .orderBy('park.continent', 'ASC')
      .getRawMany();

    const continents = result
      .map((item: { continent: string }) => item.continent)
      .filter(Boolean);

    this.cache = { value: continents, timestamp: Date.now() };

    return continents;
  }
}
