import { Injectable } from '@nestjs/common';

@Injectable()
export class ParksService {
  findAll() {
    return { message: 'Liste aller Parks' };
  }

  findOne(id: string) {
    return { message: `Park mit ID ${id}` };
  }
} 