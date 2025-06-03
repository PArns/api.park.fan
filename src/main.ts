import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { DatabaseService } from './modules/database/database.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  
  // Create database first
  const tempApp = await NestFactory.createApplicationContext(AppModule);
  const databaseService = tempApp.get(DatabaseService);
  await databaseService.createDatabaseIfNotExists();
  await tempApp.close();
  
  // Now start the real app
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;
  
  await app.listen(port);
}

bootstrap();