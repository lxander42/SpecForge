import { logger } from '../telemetry/logger.js';

export class ReadmeService {
  generateReadme(): string {
    logger.info('README generation - placeholder implementation');
    return '# SpecForge Project\n\nGenerated README content coming soon!';
  }
}

export function getReadmeService(): ReadmeService {
  return new ReadmeService();
}
