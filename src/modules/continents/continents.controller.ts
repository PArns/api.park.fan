import { Controller, Get } from '@nestjs/common';
import { ContinentsService } from './continents.service.js';

@Controller('continents')
export class ContinentsController {
  constructor(private readonly continentsService: ContinentsService) {}

  @Get()
  async getContinents() {
    return this.continentsService.getContinents();
  }
}
