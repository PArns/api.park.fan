import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ParkGroup } from './park-group.entity';
import { Park } from './park.entity';
import { ThemeArea } from './theme-area.entity';
import { Ride } from './ride.entity';
import { QueueTime } from './queue-time.entity';
import { WeatherData } from './weather-cache.entity.js';
import { ParksController } from './parks.controller.js';
import { ParksService } from './parks.service';
import { CrowdLevelService } from './crowd-level.service.js';
import { WeatherService } from './weather.service.js';
import { DatabaseWeatherCacheService } from './database-weather-cache.service.js';
import { WeatherBackgroundService } from './weather-background.service.js';
import { WEATHER_CACHE_SERVICE } from './weather-cache.interface.js';
import { QueueTimesParserService } from '../queue-times-parser/queue-times-parser.service';
import { RidesService } from '../rides/rides.service';
import { RidesModule } from '../rides/rides.module';
import { UtilsModule } from '../utils/utils.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ParkGroup,
      Park,
      ThemeArea,
      Ride,
      QueueTime,
      WeatherData,
    ]),
    ScheduleModule.forRoot(),
    UtilsModule,
    RidesModule,
  ],
  controllers: [ParksController],
  providers: [
    ParksService,
    QueueTimesParserService,
    CrowdLevelService,
    WeatherService,
    DatabaseWeatherCacheService,
    WeatherBackgroundService,
    {
      provide: WEATHER_CACHE_SERVICE,
      useClass: DatabaseWeatherCacheService,
    },
  ],
  exports: [
    TypeOrmModule,
    ParksService,
    CrowdLevelService,
    WeatherBackgroundService,
  ],
})
export class ParksModule {}
