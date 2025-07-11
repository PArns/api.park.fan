import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParkUtilsService } from './park-utils.service.js';
import { ReadmeService } from './readme.service.js';
import { CacheControlInterceptor } from './cache-control.interceptor.js';
import { HierarchicalUrlService } from './hierarchical-url.service.js';
import { HierarchicalUrlInjectorService } from './hierarchical-url-injector.service.js';
import { CacheService } from './cache.service.js';
import { Ride } from '../parks/ride.entity.js';
import { QueueTime } from '../parks/queue-time.entity.js';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Ride, QueueTime])],
  providers: [
    ParkUtilsService,
    ReadmeService,
    CacheControlInterceptor,
    HierarchicalUrlService,
    HierarchicalUrlInjectorService,
    CacheService,
  ],
  exports: [
    ParkUtilsService,
    ReadmeService,
    CacheControlInterceptor,
    HierarchicalUrlService,
    HierarchicalUrlInjectorService,
    CacheService,
  ],
})
export class UtilsModule {}
