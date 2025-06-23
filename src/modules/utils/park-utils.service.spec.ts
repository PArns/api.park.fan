import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ParkUtilsService } from './park-utils.service';
import { Ride } from '../parks/ride.entity';
import { QueueTime } from '../parks/queue-time.entity';

describe('ParkUtilsService', () => {
  let service: ParkUtilsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        ParkUtilsService,
        { provide: getRepositoryToken(Ride), useValue: {} },
        {
          provide: getRepositoryToken(QueueTime),
          useValue: { query: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(ParkUtilsService);
  });

  it('merges rides from theme areas and park without duplicates', () => {
    const ride1: any = { id: 1, name: 'R1', isActive: true, queueTimes: [] };
    const ride2: any = { id: 2, name: 'R2', isActive: true, queueTimes: [] };
    const park: any = {
      id: 1,
      name: 'Park',
      country: 'X',
      continent: 'Y',
      themeAreas: [{ id: 1, name: 'Area', rides: [ride1, ride2] }],
      rides: [ride2],
    };

    const rides = service.getAllRidesFromPark(park);
    expect(rides).toHaveLength(2);
    expect(rides.map((r) => r.id)).toEqual([1, 2]);
  });

  it('calculates park open status based on threshold', () => {
    const now = new Date();
    const openRide: any = {
      id: 1,
      name: 'Open',
      isActive: true,
      queueTimes: [{ waitTime: 10, isOpen: true, lastUpdated: now }],
    };
    const closedRide: any = {
      id: 2,
      name: 'Closed',
      isActive: true,
      queueTimes: [{ waitTime: 0, isOpen: false, lastUpdated: now }],
    };
    const park: any = {
      id: 1,
      name: 'Park',
      country: 'X',
      continent: 'Y',
      themeAreas: [{ id: 1, name: 'Area', rides: [openRide, closedRide] }],
    };

    expect(service.calculateParkOpenStatus(park, 50)).toBe(true);
    expect(service.calculateParkOpenStatus(park, 80)).toBe(false);
  });
});
