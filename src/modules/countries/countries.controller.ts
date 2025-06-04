import { Controller, Get } from '@nestjs/common';
import { CountriesService } from './countries.service.js';

@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  async getCountries() {
    return this.countriesService.getCountries();
  }
}
