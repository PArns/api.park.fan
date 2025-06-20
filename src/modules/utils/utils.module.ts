import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ParkUtilsService } from './park-utils.service.js';
import { ReadmeService } from './readme.service.js';
import { CacheControlInterceptor } from './cache-control.interceptor.js';
import { HierarchicalUrlService } from './hierarchical-url.service.js';
import { HierarchicalUrlInjectorService } from './hierarchical-url-injector.service.js';

@Module({
  imports: [ConfigModule],
  providers: [
    ParkUtilsService,
    ReadmeService,
    CacheControlInterceptor,
    HierarchicalUrlService,
    HierarchicalUrlInjectorService,
  ],
  exports: [
    ParkUtilsService,
    ReadmeService,
    CacheControlInterceptor,
    HierarchicalUrlService,
    HierarchicalUrlInjectorService,
  ],
})
export class UtilsModule {}
