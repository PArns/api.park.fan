import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParkGroup } from './park-group.entity';
import { Park } from './park.entity';
import { ThemeArea } from './theme-area.entity';
import { Ride } from './ride.entity';
import { QueueTime } from './queue-time.entity';
import { ParksController } from './parks.controller.js';
import { ParksService } from './parks.service';
import { CrowdLevelService } from './crowd-level.service.js';
import { QueueTimesParserService } from '../queue-times-parser/queue-times-parser.service';
import { RidesService } from '../rides/rides.service';
import { UtilsModule } from '../utils/utils.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParkGroup, Park, ThemeArea, Ride, QueueTime]),
    UtilsModule,
  ],
  controllers: [ParksController],
  providers: [
    ParksService,
    RidesService,
    QueueTimesParserService,
    CrowdLevelService,
  ],
  exports: [TypeOrmModule, ParksService, CrowdLevelService],
})
export class ParksModule {}
