import { RequirementsPackage, Requirement, Baseline, ChangeLog } from '../../models/entities.js';
import { logger } from '../telemetry/logger.js';
import { SpecForgeError } from '../../lib/errors.js';
import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface RequirementsSection {
  title: string;
  requirements: Requirement[];
  description?: string;
  order: number;
}

export interface RequirementsWriterOptions {
  outputDir?: string;
  baselinesDir?: string;
  includeMetadata?: boolean;
  generateToc?: boolean;
  templatePath?: string;
}

export interface BaselineOptions {
  tag: string;
  approver: string;
  changeLogPath?: string;
  createArchive?: boolean;
}

export class RequirementsWriterService {
  private defaultOutputDir = 'requirements';
  private defaultBaselinesDir = 'baselines';

  /**
   * Write a requirements package to markdown files
   */
  async writeRequirementsPackage(
    pkg: RequirementsPackage,
    options: RequirementsWriterOptions = {}
  ): Promise<void> {
    const outputDir = options.outputDir || this.defaultOutputDir;
    logger.info(`Writing requirements package to ${outputDir}`, {
      version: pkg.version,
      sectionsCount: Object.keys(pkg.sections).length,
    });

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Write main requirements document
    const mainContent = await this.generateMainDocument(pkg, options);
    await fs.writeFile(path.join(outputDir, 'requirements.md'), mainContent);

    // Write individual section files
    for (const [sectionKey, section] of Object.entries(pkg.sections)) {
      const sectionContent = await this.generateSectionDocument(section, pkg, options);
      const filename = `${sectionKey.toLowerCase().replace(/\s+/g, '-')}.md`;
      await fs.writeFile(path.join(outputDir, filename), sectionContent);
    }

    // Write metadata file
    if (options.includeMetadata !== false) {
      const metadataContent = this.generateMetadata(pkg);
      await fs.writeFile(path.join(outputDir, 'metadata.json'), metadataContent);
    }

    logger.info(`Requirements package written successfully to ${outputDir}`);
  }

  /**
   * Create a baseline snapshot of requirements
   */
  async createBaseline(
    pkg: RequirementsPackage,
    options: BaselineOptions,
    writerOptions: RequirementsWriterOptions = {}
  ): Promise<Baseline> {
    const baselinesDir = writerOptions.baselinesDir || this.defaultBaselinesDir;
    const baselineDir = path.join(baselinesDir, options.tag);
    
    logger.info(`Creating baseline ${options.tag}`, {
      version: pkg.version,
      baselinesDir,
    });

    // Ensure baselines directory exists
    await fs.mkdir(baselineDir, { recursive: true });

    // Create baseline metadata
    const baseline: Baseline = {
      tag: options.tag,
      date: new Date().toISOString(),
      approver: options.approver,
      changeLogRef: options.changeLogPath,
      packageVersion: pkg.version,
      contentHash: this.calculatePackageHash(pkg),
    };

    // Write baseline metadata
    await fs.writeFile(
      path.join(baselineDir, 'baseline.json'),
      JSON.stringify(baseline, null, 2)
    );

    // Archive requirements package
    if (options.createArchive !== false) {
      await this.writeRequirementsPackage(pkg, {
        ...writerOptions,
        outputDir: baselineDir,
      });
    }

    // Update package with baseline tag
    const updatedPackage = {
      ...pkg,
      baselineTag: options.tag,
    };

    // Write updated package
    await this.writeRequirementsPackage(updatedPackage, writerOptions);

    logger.info(`Baseline ${options.tag} created successfully`);
    return baseline;
  }

  /**
   * Generate changelog between baselines
   */
  async generateChangeLog(
    previousBaseline: Baseline,
    currentPackage: RequirementsPackage,
    outputPath?: string
  ): Promise<ChangeLog> {
    logger.info('Generating changelog', {
      from: previousBaseline.tag,
      to: currentPackage.version,
    });

    // Load previous package if available
    const previousPackage = await this.loadBaselinePackage(previousBaseline);
    
    // Compare packages and generate changelog entries
    const entries = this.comparePackages(previousPackage, currentPackage);

    const changeLog: ChangeLog = {
      path: outputPath || 'CHANGELOG.md',
      fromBaseline: previousBaseline.tag,
      toVersion: currentPackage.version,
      generatedAt: new Date().toISOString(),
      entries,
    };

    // Write changelog if path specified
    if (outputPath) {
      const content = this.generateChangeLogMarkdown(changeLog);
      await fs.writeFile(outputPath, content);
    }

    logger.info(`Generated changelog with ${entries.length} entries`);
    return changeLog;
  }

  /**
   * Load requirements package from directory
   */
  async loadRequirementsPackage(packageDir: string): Promise<RequirementsPackage> {
    logger.debug(`Loading requirements package from ${packageDir}`);

    try {
      // Load metadata
      const metadataPath = path.join(packageDir, 'metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      // Load sections
      const sections: Record<string, RequirementsSection> = {};
      
      const sectionFiles = await fs.readdir(packageDir);
      for (const file of sectionFiles) {
        if (file.endsWith('.md') && file !== 'requirements.md') {
          const sectionKey = file.replace('.md', '').replace(/-/g, ' ');
          const sectionPath = path.join(packageDir, file);
          const section = await this.parseMarkdownSection(sectionPath);
          sections[sectionKey] = section;
        }
      }

      return {
        path: packageDir,
        version: metadata.version,
        baselineTag: metadata.baselineTag,
        sections,
        generatedAt: metadata.generatedAt,
        contentHash: metadata.contentHash,
      };
    } catch (error) {
      throw new SpecForgeError(`Failed to load requirements package from ${packageDir}`, {
        cause: error,
        packageDir,
      });
    }
  }

  /**
   * Generate main requirements document
   */
  private async generateMainDocument(
    pkg: RequirementsPackage,
    options: RequirementsWriterOptions
  ): Promise<string> {
    const sections = Object.entries(pkg.sections)
      .sort(([, a], [, b]) => a.order - b.order);

    let content = `# Requirements Document\n\n`;
    content += `**Version**: ${pkg.version}\n`;
    content += `**Generated**: ${new Date().toISOString()}\n`;
    if (pkg.baselineTag) {
      content += `**Baseline**: ${pkg.baselineTag}\n`;
    }
    content += '\n';

    // Table of contents
    if (options.generateToc !== false) {
      content += '## Table of Contents\n\n';
      for (const [sectionKey, section] of sections) {
        content += `- [${section.title}](#${this.slugify(section.title)})\n`;
      }
      content += '\n';
    }

    // Section summaries
    for (const [sectionKey, section] of sections) {
      content += `## ${section.title}\n\n`;
      if (section.description) {
        content += `${section.description}\n\n`;
      }
      content += `**Requirements Count**: ${section.requirements.length}\n\n`;
      content += `See [${sectionKey.toLowerCase().replace(/\s+/g, '-')}.md](./${sectionKey.toLowerCase().replace(/\s+/g, '-')}.md) for detailed requirements.\n\n`;
    }

    return content;
  }

  /**
   * Generate section document
   */
  private async generateSectionDocument(
    section: RequirementsSection,
    pkg: RequirementsPackage,
    options: RequirementsWriterOptions
  ): Promise<string> {
    let content = `# ${section.title}\n\n`;
    
    if (section.description) {
      content += `${section.description}\n\n`;
    }

    content += `**Requirements Count**: ${section.requirements.length}\n`;
    content += `**Package Version**: ${pkg.version}\n\n`;

    // Requirements
    for (const requirement of section.requirements) {
      content += `## ${requirement.id}\n\n`;
      content += `**Text**: ${requirement.text}\n\n`;
      
      if (requirement.acceptanceCriteria && requirement.acceptanceCriteria.length > 0) {
        content += '**Acceptance Criteria**:\n';
        for (const criteria of requirement.acceptanceCriteria) {
          content += `- ${criteria}\n`;
        }
        content += '\n';
      }

      if (requirement.verificationMethod) {
        content += `**Verification Method**: ${requirement.verificationMethod}\n\n`;
      }

      if (requirement.rationale) {
        content += `**Rationale**: ${requirement.rationale}\n\n`;
      }

      if (requirement.priority) {
        content += `**Priority**: ${requirement.priority}\n\n`;
      }

      content += '---\n\n';
    }

    return content;
  }

  /**
   * Generate metadata JSON
   */
  private generateMetadata(pkg: RequirementsPackage): string {
    const metadata = {
      version: pkg.version,
      baselineTag: pkg.baselineTag,
      generatedAt: new Date().toISOString(),
      contentHash: this.calculatePackageHash(pkg),
      sections: Object.keys(pkg.sections),
      totalRequirements: Object.values(pkg.sections)
        .reduce((sum, section) => sum + section.requirements.length, 0),
    };

    return JSON.stringify(metadata, null, 2);
  }

  /**
   * Calculate content hash for package
   */
  private calculatePackageHash(pkg: RequirementsPackage): string {
    const hashableContent = {
      version: pkg.version,
      sections: Object.entries(pkg.sections)
        .sort(([a], [b]) => a.localeCompare(b))
        .reduce((acc, [key, section]) => {
          acc[key] = {
            title: section.title,
            requirements: section.requirements.map(req => ({
              id: req.id,
              text: req.text,
              acceptanceCriteria: req.acceptanceCriteria,
              verificationMethod: req.verificationMethod,
            })),
          };
          return acc;
        }, {} as Record<string, any>),
    };

    const serialized = JSON.stringify(hashableContent);
    return createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Load baseline package
   */
  private async loadBaselinePackage(baseline: Baseline): Promise<RequirementsPackage | null> {
    try {
      const baselineDir = path.join(this.defaultBaselinesDir, baseline.tag);
      return await this.loadRequirementsPackage(baselineDir);
    } catch (error) {
      logger.warn(`Could not load baseline package for ${baseline.tag}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Compare two packages and generate changelog entries
   */
  private comparePackages(
    previous: RequirementsPackage | null,
    current: RequirementsPackage
  ): ChangeLog['entries'] {
    const entries: ChangeLog['entries'] = [];

    if (!previous) {
      entries.push({
        id: 'initial',
        type: 'added',
        summary: 'Initial requirements package created',
        details: `Created with ${Object.keys(current.sections).length} sections`,
      });
      return entries;
    }

    // Compare sections
    const previousSections = new Set(Object.keys(previous.sections));
    const currentSections = new Set(Object.keys(current.sections));

    // Added sections
    for (const section of currentSections) {
      if (!previousSections.has(section)) {
        entries.push({
          id: `section-${section}`,
          type: 'added',
          summary: `Added section: ${section}`,
          details: `New section with ${current.sections[section].requirements.length} requirements`,
        });
      }
    }

    // Removed sections
    for (const section of previousSections) {
      if (!currentSections.has(section)) {
        entries.push({
          id: `section-${section}`,
          type: 'removed',
          summary: `Removed section: ${section}`,
          details: `Section had ${previous.sections[section].requirements.length} requirements`,
        });
      }
    }

    // Compare requirements in common sections
    for (const section of currentSections) {
      if (previousSections.has(section)) {
        const sectionEntries = this.compareRequirements(
          previous.sections[section].requirements,
          current.sections[section].requirements,
          section
        );
        entries.push(...sectionEntries);
      }
    }

    return entries;
  }

  /**
   * Compare requirements between sections
   */
  private compareRequirements(
    previous: Requirement[],
    current: Requirement[],
    sectionName: string
  ): ChangeLog['entries'] {
    const entries: ChangeLog['entries'] = [];
    
    const previousMap = new Map(previous.map(req => [req.id, req]));
    const currentMap = new Map(current.map(req => [req.id, req]));

    // Added requirements
    for (const [id, req] of currentMap) {
      if (!previousMap.has(id)) {
        entries.push({
          id: `req-${id}`,
          type: 'added',
          summary: `Added requirement ${id} in ${sectionName}`,
          details: req.text.substring(0, 100) + (req.text.length > 100 ? '...' : ''),
        });
      }
    }

    // Removed requirements
    for (const [id, req] of previousMap) {
      if (!currentMap.has(id)) {
        entries.push({
          id: `req-${id}`,
          type: 'removed',
          summary: `Removed requirement ${id} from ${sectionName}`,
          details: req.text.substring(0, 100) + (req.text.length > 100 ? '...' : ''),
        });
      }
    }

    // Modified requirements
    for (const [id, currentReq] of currentMap) {
      const previousReq = previousMap.get(id);
      if (previousReq && !this.areRequirementsEqual(previousReq, currentReq)) {
        entries.push({
          id: `req-${id}`,
          type: 'changed',
          summary: `Modified requirement ${id} in ${sectionName}`,
          details: this.getRequirementChanges(previousReq, currentReq),
        });
      }
    }

    return entries;
  }

  /**
   * Check if two requirements are equal
   */
  private areRequirementsEqual(a: Requirement, b: Requirement): boolean {
    return (
      a.text === b.text &&
      a.verificationMethod === b.verificationMethod &&
      JSON.stringify(a.acceptanceCriteria) === JSON.stringify(b.acceptanceCriteria)
    );
  }

  /**
   * Get description of changes between requirements
   */
  private getRequirementChanges(previous: Requirement, current: Requirement): string {
    const changes: string[] = [];

    if (previous.text !== current.text) {
      changes.push('text updated');
    }
    if (previous.verificationMethod !== current.verificationMethod) {
      changes.push('verification method changed');
    }
    if (JSON.stringify(previous.acceptanceCriteria) !== JSON.stringify(current.acceptanceCriteria)) {
      changes.push('acceptance criteria modified');
    }

    return changes.join(', ');
  }

  /**
   * Generate changelog markdown
   */
  private generateChangeLogMarkdown(changeLog: ChangeLog): string {
    let content = `# Changelog\n\n`;
    content += `**From**: ${changeLog.fromBaseline}\n`;
    content += `**To**: ${changeLog.toVersion}\n`;
    content += `**Generated**: ${changeLog.generatedAt}\n\n`;

    const entriesByType = {
      added: changeLog.entries.filter(e => e.type === 'added'),
      changed: changeLog.entries.filter(e => e.type === 'changed'),
      removed: changeLog.entries.filter(e => e.type === 'removed'),
    };

    for (const [type, entries] of Object.entries(entriesByType)) {
      if (entries.length > 0) {
        content += `## ${type.charAt(0).toUpperCase() + type.slice(1)}\n\n`;
        for (const entry of entries) {
          content += `- **${entry.summary}**\n`;
          if (entry.details) {
            content += `  ${entry.details}\n`;
          }
          content += '\n';
        }
      }
    }

    return content;
  }

  /**
   * Parse markdown section file
   */
  private async parseMarkdownSection(filePath: string): Promise<RequirementsSection> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let title = '';
    let description = '';
    const requirements: Requirement[] = [];
    let currentRequirement: Partial<Requirement> | null = null;
    let inDescription = false;

    for (const line of lines) {
      if (line.startsWith('# ')) {
        title = line.substring(2).trim();
        inDescription = true;
      } else if (line.startsWith('## ') && line.match(/^## [A-Z]+-\d+/)) {
        // Save previous requirement
        if (currentRequirement && currentRequirement.id) {
          requirements.push(currentRequirement as Requirement);
        }
        
        // Start new requirement
        currentRequirement = {
          id: line.substring(3).trim(),
          section: title,
          text: '',
          acceptanceCriteria: [],
        };
        inDescription = false;
      } else if (line.startsWith('**Text**:') && currentRequirement) {
        currentRequirement.text = line.substring(9).trim();
      } else if (line.startsWith('**Verification Method**:') && currentRequirement) {
        currentRequirement.verificationMethod = line.substring(24).trim();
      } else if (inDescription && line.trim() && !line.startsWith('**')) {
        description += line + '\n';
      }
    }

    // Save last requirement
    if (currentRequirement && currentRequirement.id) {
      requirements.push(currentRequirement as Requirement);
    }

    return {
      title,
      description: description.trim(),
      requirements,
      order: 1,
    };
  }

  /**
   * Convert string to URL slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}

// Singleton instance
let requirementsWriterInstance: RequirementsWriterService | null = null;

/**
 * Get or create the requirements writer service singleton
 */
export function getRequirementsWriterService(): RequirementsWriterService {
  if (!requirementsWriterInstance) {
    requirementsWriterInstance = new RequirementsWriterService();
  }
  return requirementsWriterInstance;
}

/**
 * Reset the requirements writer service singleton (useful for testing)
 */
export function resetRequirementsWriterService(): void {
  requirementsWriterInstance = null;
}
