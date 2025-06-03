import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueTimesParserService } from './queue-times-parser.service';

@Injectable()
export class QueueTimesScheduler {
  constructor(private readonly parser: QueueTimesParserService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async fetchParks() {
    await this.parser.fetchAndStoreParks();
  }

  @Cron('*/5 * * * *')
  async fetchQueueTimes() {
    await this.parser.fetchAndStoreQueueTimes();
  }
}
