import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContinentsController } from './continents.controller.js';
import { ContinentsService } from './continents.service.js';
import { Park } from '../parks/park.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Park])],
  controllers: [ContinentsController],
  providers: [ContinentsService],
})
export class ContinentsModule {}
