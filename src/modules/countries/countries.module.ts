import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountriesController } from './countries.controller.js';
import { CountriesService } from './countries.service.js';
import { Park } from '../parks/park.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Park])],
  controllers: [CountriesController],
  providers: [CountriesService],
})
export class CountriesModule {}
