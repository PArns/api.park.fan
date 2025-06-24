import { Module } from '@nestjs/common';
import { ParksModule } from '../parks/parks.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParkGroup } from '../parks/park-group.entity';
import { Park } from '../parks/park.entity';
import { ThemeArea } from '../parks/theme-area.entity';
import { Ride } from '../parks/ride.entity';
import { QueueTime } from '../parks/queue-time.entity';
import { QueueTimesParserService } from './queue-times-parser.service.js';
import { QueueTimesScheduler } from './queue-times-scheduler.service.js';
import { UtilsModule } from '../utils/utils.module.js';

@Module({
  imports: [
    ParksModule,
    TypeOrmModule.forFeature([ParkGroup, Park, ThemeArea, Ride, QueueTime]),
    UtilsModule,
  ],
  providers: [QueueTimesParserService, QueueTimesScheduler],
  exports: [QueueTimesParserService],
})
export class QueueTimesParserModule {}
