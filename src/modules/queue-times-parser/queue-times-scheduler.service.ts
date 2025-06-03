import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueTimesParserService } from './queue-times-parser.service';

@Injectable()
export class QueueTimesScheduler implements OnModuleInit {
  private readonly logger = new Logger(QueueTimesScheduler.name);

  constructor(private readonly parser: QueueTimesParserService) {}
  async onModuleInit() {
    // Start initial data fetch in background - don't block application startup
    this.performInitialDataFetch();
  }

  private async performInitialDataFetch() {
    this.logger.log('Starting initial data fetch in background...');
    try {
      await this.parser.fetchAndStoreParks();
      this.logger.log('Initial parks fetch completed');
      
      // Wait a moment before fetching queue times
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await this.parser.fetchAndStoreQueueTimes();
      this.logger.log('Initial queue times fetch completed');
    } catch (error) {
      this.logger.error('Error during initial data fetch:', error);
      // Retry in 5 minutes if initial fetch fails
      setTimeout(() => {
        this.logger.log('Retrying initial data fetch...');
        this.performInitialDataFetch();
      }, 5 * 60 * 1000);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async fetchParks() {
    await this.parser.fetchAndStoreParks();
  }

  @Cron('*/5 * * * *')
  async fetchQueueTimes() {
    await this.parser.fetchAndStoreQueueTimes();
  }
}
