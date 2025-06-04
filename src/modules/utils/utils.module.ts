import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ParkUtilsService } from './park-utils.service.js';
import { ReadmeService } from './readme.service.js';

@Module({
  imports: [ConfigModule],
  providers: [ParkUtilsService, ReadmeService],
  exports: [ParkUtilsService, ReadmeService],
})
export class UtilsModule {}
