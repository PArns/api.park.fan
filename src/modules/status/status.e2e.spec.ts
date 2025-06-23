import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { StatusModule } from './status.module';

describe('Status endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [StatusModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('/status returns OK', async () => {
    await request(app.getHttpServer())
      .get('/status')
      .expect(200)
      .expect({ status: 'OK' });
  });
});
