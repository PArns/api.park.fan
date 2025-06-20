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
import { WeatherService } from './weather.service.js';
import { MemoryWeatherCacheService } from './memory-weather-cache.service.js';
import { WEATHER_CACHE_SERVICE } from './weather-cache.interface.js';
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
    WeatherService,
    {
      provide: WEATHER_CACHE_SERVICE,
      useClass: MemoryWeatherCacheService,
    },
  ],
  exports: [TypeOrmModule, ParksService, CrowdLevelService],
})
export class ParksModule {}
