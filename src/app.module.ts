import { Module } from '@nestjs/common';
import { ParksModule } from './modules/parks/parks.module';
import { StatusModule } from './modules/status/status.module';

@Module({
  imports: [ParksModule, StatusModule],
  controllers: [],
  providers: [],
})
export class AppModule {} 