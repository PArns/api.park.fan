import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;
  
  await app.listen(port);
  logger.log(`🚀 API server is running on http://localhost:${port}`);
  logger.log(`📊 Queue time statistics: GET http://localhost:${port}/parks/queue-times/statistics`);
  logger.log(`🧹 Cleanup duplicates: POST http://localhost:${port}/parks/queue-times/cleanup-duplicates`);
  logger.log(`🔄 Manual fetch: POST http://localhost:${port}/parks/queue-times/fetch`);
}

bootstrap();