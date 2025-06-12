import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReadmeService } from '../utils/readme.service.js';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class IndexController {
  constructor(private readonly readmeService: ReadmeService) {}

  /**
   * Main index endpoint that renders the README as HTML
   */
  @Get()
  @Header('Content-Type', 'text/html')
  getIndex(@Res() res: Response): void {
    const html = this.readmeService.getReadmeAsHtml();
    res.send(html);
  }

  /**
   * Get the raw README markdown
   */
  @Get('readme')
  @Header('Content-Type', 'text/markdown')
  getReadme(): string {
    return this.readmeService.getReadmeAsMarkdown();
  }

  /**
   * Get the OpenAPI specification YAML
   */
  @Get('openapi.yaml')
  @Header('Content-Type', 'application/x-yaml')
  getOpenApiSpec(@Res() res: Response): void {
    try {
      const yamlPath = path.join(process.cwd(), 'openapi.yaml');
      
      if (!fs.existsSync(yamlPath)) {
        res.status(404).send('OpenAPI specification not found');
        return;
      }

      const yamlContent = fs.readFileSync(yamlPath, 'utf8');
      res.send(yamlContent);
    } catch (error) {
      res.status(500).send('Error reading OpenAPI specification');
    }
  }
}
