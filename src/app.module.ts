import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StatusModule } from './modules/status/status.module';
import { ParksModule } from './modules/parks/parks.module';
import { RidesModule } from './modules/rides/rides.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { CountriesModule } from './modules/countries/countries.module';
import { ContinentsModule } from './modules/continents/continents.module';
import { QueueTimesParserModule } from './modules/queue-times-parser/queue-times-parser.module';
import { UtilsModule } from './modules/utils/utils.module';
import { ScheduleModule } from '@nestjs/schedule';
import { IndexModule } from './modules/index/index.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USER', 'postgres'),
        password: configService.get('DB_PASS', 'postgres'),
        database: configService.get('DB_NAME', 'parkfan'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    StatusModule,
    ParksModule,
    RidesModule,
    StatisticsModule,
    CountriesModule,
    ContinentsModule,
    QueueTimesParserModule,
    UtilsModule,
    IndexModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
