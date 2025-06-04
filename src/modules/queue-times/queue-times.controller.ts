import { Controller, Get } from '@nestjs/common';
import { QueueTimesParserService } from '../queue-times-parser/queue-times-parser.service.js';

@Controller('queue-times')
export class QueueTimesController {
  constructor(
    private readonly queueTimesParserService: QueueTimesParserService,
  ) {}

  @Get('statistics')
  async getQueueTimeStatistics() {
    return await this.queueTimesParserService.getQueueTimeStatistics();
  }
}
