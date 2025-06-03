import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { QueueTimesParserService } from '../queue-times-parser/queue-times-parser.service.js';
import { ParksService } from './parks.service.js';
import { ParkQueryDto } from './parks.dto.js';

@Controller('parks')
export class ParksController {
  constructor(
    private readonly queueTimesParserService: QueueTimesParserService,
    private readonly parksService: ParksService,
  ) {}
  // Readonly API endpoints for parks
  @Get()
  async findAll(@Query() query: ParkQueryDto) {
    return this.parksService.findAll(query);
  }

  @Get('statistics')
  async getStatistics() {
    return this.parksService.getStatistics();
  }

  @Get('countries')
  async getCountries() {
    return this.parksService.getCountries();
  }

  @Get('continents')
  async getContinents() {
    return this.parksService.getContinents();
  }
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.parksService.findOne(id);
  }
  // Queue times related endpoints
  @Get('queue-times/statistics')
  async getQueueTimeStatistics() {
    return await this.queueTimesParserService.getQueueTimeStatistics();
  }
}