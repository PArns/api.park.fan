import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueTimesParserService } from './queue-times-parser.service';

@Injectable()
export class QueueTimesScheduler implements OnModuleInit {
  private readonly logger = new Logger(QueueTimesScheduler.name);

  constructor(private readonly parser: QueueTimesParserService) {}
  async onModuleInit() {
    // Wait a bit for TypeORM to be ready, then start initial data fetch
    setTimeout(() => {
      this.performInitialDataFetch();
    }, 5000); // 5 seconds delay
  }

  private async performInitialDataFetch() {
    this.logger.log('Starting initial data fetch...');
    try {
      // Check if database is ready by testing a simple query
      await this.waitForDatabase();

      await this.parser.fetchAndStoreParks();
      this.logger.log('Initial parks fetch completed');

      // Wait a moment before fetching queue times
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await this.parser.fetchAndStoreQueueTimes();
      this.logger.log('Initial queue times fetch completed');
    } catch (error) {
      this.logger.error('Error during initial data fetch:', error);
      // Retry in 30 seconds if initial fetch fails
      setTimeout(() => {
        this.logger.log('Retrying initial data fetch...');
        this.performInitialDataFetch();
      }, 30 * 1000);
    }
  }

  private async waitForDatabase(): Promise<void> {
    const maxRetries = 10;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        // Try a simple database operation to check if connection is ready
        await this.parser.getQueueTimeStatistics();
        this.logger.log('Database connection is ready');
        return;
      } catch (error) {
        retries++;
        this.logger.log(
          `Database not ready yet, retry ${retries}/${maxRetries}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Database connection timeout after maximum retries');
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
