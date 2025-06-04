import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReadmeService } from '../utils/readme.service.js';

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
}
