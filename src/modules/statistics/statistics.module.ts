import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsController } from './statistics.controller.js';
import { StatisticsService } from './statistics.service.js';
import { Park } from '../parks/park.entity.js';
import { ThemeArea } from '../parks/theme-area.entity.js';
import { Ride } from '../parks/ride.entity.js';
import { UtilsModule } from '../utils/utils.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Park, ThemeArea, Ride]), UtilsModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
