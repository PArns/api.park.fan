import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RidesController } from './rides.controller.js';
import { RidesService } from './rides.service.js';
import { Ride } from '../parks/ride.entity.js';
import { UtilsModule } from '../utils/utils.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Ride]), UtilsModule],
  controllers: [RidesController],
  providers: [RidesService],
  exports: [RidesService],
})
export class RidesModule {}
