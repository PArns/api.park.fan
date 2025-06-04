import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ParkUtilsService } from './park-utils.service.js';

@Module({
  imports: [ConfigModule],
  providers: [ParkUtilsService],
  exports: [ParkUtilsService],
})
export class UtilsModule {}
