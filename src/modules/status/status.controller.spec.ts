import { Test } from '@nestjs/testing';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';

describe('StatusController', () => {
  let controller: StatusController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [StatusController],
      providers: [StatusService],
    }).compile();

    controller = moduleRef.get(StatusController);
  });

  it('returns API status', () => {
    expect(controller.getStatus()).toEqual({ status: 'OK' });
  });
});
