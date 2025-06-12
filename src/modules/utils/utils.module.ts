import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ParkUtilsService } from './park-utils.service.js';
import { ReadmeService } from './readme.service.js';
import { CacheControlInterceptor } from './cache-control.interceptor.js';
import { HierarchicalUrlService } from './hierarchical-url.service.js';

@Module({
  imports: [ConfigModule],
  providers: [
    ParkUtilsService,
    ReadmeService,
    CacheControlInterceptor,
    HierarchicalUrlService,
  ],
  exports: [
    ParkUtilsService,
    ReadmeService,
    CacheControlInterceptor,
    HierarchicalUrlService,
  ],
})
export class UtilsModule {}
