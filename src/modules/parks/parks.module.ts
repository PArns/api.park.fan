import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParkGroup } from './park-group.entity';
import { Park } from './park.entity';
import { ThemeArea } from './theme-area.entity';
import { Ride } from './ride.entity';
import { QueueTime } from './queue-time.entity';
import { ParksController } from './parks.controller';
import { ParksService } from './parks.service';
import { QueueTimesParserService } from '../queue-times-parser/queue-times-parser.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParkGroup, Park, ThemeArea, Ride, QueueTime]),
  ],
  controllers: [ParksController],
  providers: [ParksService, QueueTimesParserService],
  exports: [TypeOrmModule, ParksService],
})
export class ParksModule {}
