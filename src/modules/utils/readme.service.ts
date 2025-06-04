import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { marked } from 'marked';

@Injectable()
export class ReadmeService {
  private readonly readmePath: string;
  private readmeContent: string;
  private readmeHtml: string;
  private lastReadTime: number = 0;

  constructor() {
    // Get the path to the README.md file (root directory of the project)
    this.readmePath = join(process.cwd(), 'README.md');
    this.loadReadme();
  }

  /**
   * Get the README content as HTML
   * @returns README content as HTML
   */
  getReadmeAsHtml(): string {
    // Check if README was modified since last read (every minute)
    const currentTime = Date.now();
    if (currentTime - this.lastReadTime > 60000) {
      this.loadReadme();
    }

    return this.readmeHtml;
  }

  /**
   * Get the README content as raw markdown
   * @returns README content as raw markdown
   */
  getReadmeAsMarkdown(): string {
    // Check if README was modified since last read (every minute)
    const currentTime = Date.now();
    if (currentTime - this.lastReadTime > 60000) {
      this.loadReadme();
    }

    return this.readmeContent;
  }

  /**
   * Load the README content from the file
   * @private
   */
  private loadReadme(): void {
    try {
      this.readmeContent = readFileSync(this.readmePath, 'utf8');
      this.readmeHtml = this.convertMarkdownToHtml(this.readmeContent);
      this.lastReadTime = Date.now();
    } catch (error) {
      this.readmeContent = '# Error\nCould not load README.md';
      this.readmeHtml = '<h1>Error</h1><p>Could not load README.md</p>';
    }
  }

  /**
   * Convert markdown to HTML
   * @param markdown Markdown content
   * @returns HTML content
   * @private
   */
  private convertMarkdownToHtml(markdown: string): string {
    // Apply custom styling
    const htmlContent = marked.parse(markdown);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Park.Fan API - Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        h1, h2, h3, h4 {
            margin-top: 2rem;
            margin-bottom: 1rem;
            color: #0066cc;
        }
        
        h1 {
            border-bottom: 2px solid #eaecef;
            padding-bottom: 0.3em;
        }
        
        h2 {
            border-bottom: 1px solid #eaecef;
            padding-bottom: 0.3em;
        }
        
        code {
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
            background-color: rgba(27, 31, 35, 0.05);
            border-radius: 3px;
            padding: 0.2em 0.4em;
            font-size: 85%;
        }
        
        pre {
            background-color: #f6f8fa;
            border-radius: 3px;
            padding: 16px;
            overflow: auto;
            font-size: 85%;
            line-height: 1.45;
        }
        
        pre > code {
            background-color: transparent;
            padding: 0;
        }
        
        table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 1rem;
        }
        
        table th, table td {
            padding: 0.5rem;
            border: 1px solid #dfe2e5;
        }
        
        table th {
            background-color: #f6f8fa;
            font-weight: 600;
        }
        
        blockquote {
            margin: 0;
            padding-left: 1rem;
            border-left: 0.25rem solid #dfe2e5;
            color: #6a737d;
        }
        
        img {
            max-width: 100%;
        }

        a {
            color: #0366d6;
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>
`;
  }
}
