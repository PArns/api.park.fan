import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private readonly configService: ConfigService) {}

  async createDatabaseIfNotExists() {
    const dbHost = this.configService.get('DB_HOST', 'localhost');
    const dbPort = this.configService.get<number>('DB_PORT', 5432);
    const dbUser = this.configService.get('DB_USER', 'postgres');
    const dbPass = this.configService.get('DB_PASS', 'postgres');
    const dbName = this.configService.get('DB_NAME', 'parkfan');

    const client = new Client({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPass,
      database: 'postgres', // Connect to default postgres database first
    });

    try {
      await client.connect();
      this.logger.log('Connected to PostgreSQL');

      // Check if database exists
      const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);

      if (result.rows.length === 0) {
        // Database doesn't exist, create it
        await client.query(`CREATE DATABASE "${dbName}"`);
        this.logger.log(`Database '${dbName}' created`);
      } else {
        this.logger.log(`Database '${dbName}' already exists`);
      }
    } catch (error) {
      this.logger.error(`Failed to create database: ${error.message}`);
      throw error;
    } finally {
      await client.end();
    }
  }
}
