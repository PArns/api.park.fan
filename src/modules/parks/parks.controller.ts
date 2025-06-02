import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ParksService } from './parks.service';

@Controller('parks')
export class ParksController {
  constructor(private readonly parksService: ParksService) {}

  @Get()
  findAll() {
    return this.parksService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.parksService.findOne(id);
  }
} 