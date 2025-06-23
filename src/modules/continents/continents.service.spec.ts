import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContinentsService } from './continents.service';
import { Park } from '../parks/park.entity';
import { ConfigModule } from '@nestjs/config';

describe('ContinentsService', () => {
  let service: ContinentsService;
  let repo: Repository<Park>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        ContinentsService,
        {
          provide: getRepositoryToken(Park),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ContinentsService);
    repo = moduleRef.get(getRepositoryToken(Park));
  });

  it('caches continent results', async () => {
    const qb: any = {
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ continent: 'Europe' }]),
    };
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const first = await service.getContinents();
    expect(first).toEqual(['Europe']);
    const second = await service.getContinents();
    expect(second).toEqual(['Europe']);
    expect(qb.getRawMany).toHaveBeenCalledTimes(1);
  });
});
