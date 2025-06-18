import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Client } from 'pg';

async function createDatabaseIfNotExists() {
  const logger = new Logger('DatabaseSetup');

  // Load environment variables manually
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432');
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPass = process.env.DB_PASS || 'postgres';
  const dbName = process.env.DB_NAME || 'parkfan';

  const client = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPass,
    database: 'postgres', // Connect to default postgres database first
  });

  try {
    await client.connect();
    logger.log('Connected to PostgreSQL server');

    // Check if database exists
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );

    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      await client.query(`CREATE DATABASE "${dbName}"`);
      logger.log(`Database '${dbName}' created successfully`);
    } else {
      logger.log(`Database '${dbName}' already exists`);
    }
  } catch (error) {
    logger.error(`Failed to create database: ${error.message}`);
    throw error;
  } finally {
    await client.end();
  }
}

async function bootstrap(): Promise<void> {
  // Create database BEFORE starting the NestJS app
  await createDatabaseIfNotExists();

  // Configure logging level
  const logLevel = process.env.LOG_LEVEL || 'log';
  const logLevels: ('log' | 'error' | 'warn' | 'debug' | 'verbose')[] =
    logLevel === 'debug'
      ? ['log', 'error', 'warn', 'debug', 'verbose']
      : ['log', 'error', 'warn'];

  // Now start the app - TypeORM can now connect successfully
  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
  });
  const port = process.env.PORT || 3000;

  // Enable global validation pipe with transformation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Import the CacheControlInterceptor from UtilsModule
  const { CacheControlInterceptor } = await import(
    './modules/utils/cache-control.interceptor.js'
  );

  // Register the cache interceptor globally
  app.useGlobalInterceptors(new CacheControlInterceptor());

  // Log that cache headers are enabled
  const logger = new Logger('Bootstrap');
  logger.log(
    'Cache-Control headers enabled with TTL of 300 seconds (5 minutes)',
  );
  logger.log('Global validation pipe enabled with transformation');

  await app.listen(port);
}

void bootstrap();
