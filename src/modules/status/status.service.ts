import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class StatusService {
  private version: string;

  constructor() {
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      this.version = packageJson.version || 'unknown';
    } catch (error) {
      this.version = 'unknown';
    }
  }

  getStatus(): { status: string; version: string; timestamp: string } {
    return { 
      status: 'OK',
      version: this.version,
      timestamp: new Date().toISOString()
    };
  }
}
