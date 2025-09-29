import { Command, Flags } from '@oclif/core';
import { logger } from '../services/telemetry/logger.js';
import { getRequirementsWriterService } from '../services/requirements/writer.js';
import { getConfig } from '../lib/config.js';
import { SpecForgeError } from '../lib/errors.js';
import { promptForConfirmation } from '../lib/prompts.js';
import type { Baseline, ChangeLog, RequirementsPackage } from '../models/entities.js';

export interface BaselineResult {
  success: boolean;
  baseline: {
    tag: string;
    date: string;
    approver: string;
    packageVersion: string;
    contentHash: string;
  };
  requirements: {
    sectionsIncluded: number;
    totalRequirements: number;
    packagePath: string;
  };
  changelog?: {
    path: string;
    entriesCount: number;
    fromBaseline?: string;
  };
  dryRun: boolean;
  duration: number;
}

export default class BaselineCommand extends Command {
  static override description = 'Create and approve a requirements baseline with version tagging';

  static override examples = [
    '<%= config.bin %> <%= command.id %> --tag v1.0-requirements --approver "John Doe"',
    '<%= config.bin %> <%= command.id %> --tag v1.1-requirements --approver "Jane Smith" --changelog',
    '<%= config.bin %> <%= command.id %> --tag v2.0-requirements --approver "John Doe" --dry-run --json',
    '<%= config.bin %> <%= command.id %> --approve --auto-tag --approver "CI System"',
  ];

  static override flags = {
    tag: Flags.string({
      char: 't',
      description: 'Baseline tag (e.g., v1.0-requirements)',
      required: false,
    }),
    approver: Flags.string({
      char: 'a',
      description: 'Name of the person approving this baseline',
      required: false,
    }),
    'auto-tag': Flags.boolean({
      description: 'Automatically generate baseline tag based on current date',
      default: false,
    }),
    changelog: Flags.boolean({
      description: 'Generate changelog from previous baseline',
      default: true,
    }),
    'changelog-path': Flags.string({
      description: 'Path for generated changelog file',
      default: 'CHANGELOG.md',
    }),
    approve: Flags.boolean({
      description: 'Skip confirmation prompt and approve baseline',
      default: false,
    }),
    'requirements-path': Flags.string({
      description: 'Path to requirements package',
      default: 'requirements',
    }),
    'baselines-path': Flags.string({
      description: 'Path to store baseline archives',
      default: 'baselines',
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would be baselined without creating the baseline',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output results in JSON format',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Verbose output with detailed baseline information',
      default: false,
    }),
    help: Flags.help({ char: 'h' }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(BaselineCommand);
    const startTime = Date.now();

    try {
      logger.info('Starting baseline creation', {
        tag: flags.tag,
        approver: flags.approver,
        autoTag: flags['auto-tag'],
        dryRun: flags['dry-run'],
      });

      // Validate and prepare baseline parameters
      const baselineParams = await this.prepareBaselineParameters(flags);

      // Load requirements package
      const requirementsPackage = await this.loadRequirementsPackage(flags);

      // Create baseline
      const result = await this.createBaseline(baselineParams, requirementsPackage, flags);
      result.duration = Date.now() - startTime;

      // Output results
      if (flags.json) {
        this.log(JSON.stringify(result, null, 2));
      } else {
        await this.displayResults(result, flags);
      }

      logger.info('Baseline creation completed', {
        duration: result.duration,
        success: result.success,
        tag: result.baseline.tag,
      });

    } catch (error) {
      logger.error('Baseline creation failed', { error: error instanceof Error ? error.message : String(error) }, error as Error);
      
      if (flags.json) {
        this.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        }, null, 2));
      } else {
        this.error(`Baseline creation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Prepare baseline parameters
   */
  private async prepareBaselineParameters(flags: any): Promise<{
    tag: string;
    approver: string;
    changelogPath?: string;
  }> {
    let tag = flags.tag;
    let approver = flags.approver;

    // Auto-generate tag if requested
    if (flags['auto-tag'] && !tag) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
      tag = `v${dateStr}-requirements`;
      logger.info(`Auto-generated baseline tag: ${tag}`);
    }

    // Get approver from config if not provided
    if (!approver) {
      const config = getConfig();
      approver = config.github?.org || 'Unknown';
      logger.info(`Using approver from config: ${approver}`);
    }

    // Validate required parameters
    if (!tag) {
      throw new SpecForgeError('Baseline tag is required. Use --tag or --auto-tag.');
    }

    if (!approver) {
      throw new SpecForgeError('Approver is required. Use --approver flag.');
    }

    return {
      tag,
      approver,
      changelogPath: flags.changelog ? flags['changelog-path'] : undefined,
    };
  }

  /**
   * Load requirements package
   */
  private async loadRequirementsPackage(flags: any): Promise<RequirementsPackage> {
    logger.info('Loading requirements package', { path: flags['requirements-path'] });

    try {
      const requirementsService = getRequirementsWriterService();
      const requirementsPackage = await requirementsService.loadRequirementsPackage(
        flags['requirements-path']
      );

      logger.info('Loaded requirements package', {
        version: requirementsPackage.version,
        sections: Object.keys(requirementsPackage.sections).length,
      });

      return requirementsPackage;

    } catch (error) {
      throw new SpecForgeError(
        `Failed to load requirements package from '${flags['requirements-path']}'`,
        { cause: error }
      );
    }
  }

  /**
   * Create baseline
   */
  private async createBaseline(
    params: { tag: string; approver: string; changelogPath?: string },
    requirementsPackage: RequirementsPackage,
    flags: any
  ): Promise<BaselineResult> {
    const result: BaselineResult = {
      success: false,
      baseline: {
        tag: params.tag,
        date: new Date().toISOString(),
        approver: params.approver,
        packageVersion: requirementsPackage.version || '0.1.0',
        contentHash: '',
      },
      requirements: {
        sectionsIncluded: Object.keys(requirementsPackage.sections).length,
        totalRequirements: this.countTotalRequirements(requirementsPackage),
        packagePath: flags['requirements-path'],
      },
      dryRun: flags['dry-run'],
      duration: 0,
    };

    try {
      // Check for existing baseline with same tag
      await this.checkExistingBaseline(params.tag, flags);

      // Confirm baseline creation if not auto-approved
      if (!flags.approve && !flags['dry-run'] && !flags.json) {
        const confirmed = await this.confirmBaselineCreation(params, result);
        if (!confirmed) {
          throw new SpecForgeError('Baseline creation cancelled by user');
        }
      }

      if (flags['dry-run']) {
        logger.info('[DRY RUN] Would create baseline', {
          tag: params.tag,
          approver: params.approver,
          sections: result.requirements.sectionsIncluded,
        });
        result.success = true;
        return result;
      }

      // Create baseline
      const requirementsService = getRequirementsWriterService();
      
      // Generate changelog if requested
      let changelog: ChangeLog | undefined;
      if (params.changelogPath) {
        changelog = await this.generateChangelog(
          requirementsPackage,
          params.changelogPath,
          requirementsService
        );
        
        if (changelog) {
          result.changelog = {
            path: changelog.path,
            entriesCount: changelog.entries.length,
            fromBaseline: changelog.fromBaseline,
          };
        }
      }

      // Create the baseline
      const baseline = await requirementsService.createBaseline(
        requirementsPackage,
        {
          tag: params.tag,
          approver: params.approver,
          changeLogPath: params.changelogPath,
          createArchive: true,
        },
        {
          baselinesDir: flags['baselines-path'],
        }
      );

      result.baseline.contentHash = baseline.contentHash || '';
      result.success = true;

      logger.info('Baseline created successfully', {
        tag: baseline.tag,
        approver: baseline.approver,
        contentHash: baseline.contentHash,
      });

      return result;

    } catch (error) {
      throw new SpecForgeError('Failed to create baseline', { cause: error });
    }
  }

  /**
   * Check for existing baseline with same tag
   */
  private async checkExistingBaseline(tag: string, flags: any): Promise<void> {
    // This would typically check if a baseline with the same tag already exists
    // For now, we'll just log the check
    logger.debug('Checking for existing baseline', { tag });
  }

  /**
   * Confirm baseline creation with user
   */
  private async confirmBaselineCreation(
    params: { tag: string; approver: string },
    result: BaselineResult
  ): Promise<boolean> {
    this.log('\n📋 Baseline Summary:');
    this.log(`   Tag: ${params.tag}`);
    this.log(`   Approver: ${params.approver}`);
    this.log(`   Sections: ${result.requirements.sectionsIncluded}`);
    this.log(`   Requirements: ${result.requirements.totalRequirements}`);
    this.log(`   Package Path: ${result.requirements.packagePath}`);
    this.log();

    return await promptForConfirmation('Create this baseline?');
  }

  /**
   * Generate changelog from previous baseline
   */
  private async generateChangelog(
    currentPackage: RequirementsPackage,
    changelogPath: string,
    requirementsService: any
  ): Promise<ChangeLog | undefined> {
    logger.info('Generating changelog');

    try {
      // For now, create a basic changelog
      // In a full implementation, this would compare with the previous baseline
      const changelog: ChangeLog = {
        path: changelogPath,
        toVersion: currentPackage.version || '0.1.0',
        generatedAt: new Date().toISOString(),
        entries: [
          {
            id: 'baseline-creation',
            type: 'added',
            summary: 'Initial baseline created',
            details: `Created baseline with ${Object.keys(currentPackage.sections).length} sections`,
          },
        ],
      };

      logger.info('Generated changelog', {
        entries: changelog.entries.length,
        path: changelog.path,
      });

      return changelog;

    } catch (error) {
      logger.warn('Failed to generate changelog', { error: error instanceof Error ? error.message : String(error) });
      return undefined;
    }
  }

  /**
   * Count total requirements in package
   */
  private countTotalRequirements(requirementsPackage: RequirementsPackage): number {
    return Object.values(requirementsPackage.sections)
      .reduce((total, section) => total + (section.requirements?.length || 0), 0);
  }

  /**
   * Display results in human-readable format
   */
  private async displayResults(result: BaselineResult, flags: any): Promise<void> {
    if (result.dryRun) {
      this.log('\n📋 Baseline Preview (dry run - no baseline created)\n');
    } else {
      this.log('\n✅ Requirements Baseline Created Successfully\n');
    }
    
    this.log('🏷️  Baseline Details:');
    this.log(`   Tag: ${result.baseline.tag}`);
    this.log(`   Date: ${new Date(result.baseline.date).toLocaleString()}`);
    this.log(`   Approver: ${result.baseline.approver}`);
    this.log(`   Package Version: ${result.baseline.packageVersion}`);
    if (result.baseline.contentHash) {
      this.log(`   Content Hash: ${result.baseline.contentHash.substring(0, 12)}...`);
    }
    this.log();
    
    this.log('📝 Requirements Package:');
    this.log(`   Sections Included: ${result.requirements.sectionsIncluded}`);
    this.log(`   Total Requirements: ${result.requirements.totalRequirements}`);
    this.log(`   Package Path: ${result.requirements.packagePath}`);
    this.log();
    
    if (result.changelog) {
      this.log('📜 Changelog:');
      this.log(`   Path: ${result.changelog.path}`);
      this.log(`   Entries: ${result.changelog.entriesCount}`);
      if (result.changelog.fromBaseline) {
        this.log(`   From Baseline: ${result.changelog.fromBaseline}`);
      }
      this.log();
    }
    
    this.log(`⏱️  Completed in ${result.duration}ms\n`);
    
    if (result.dryRun) {
      this.log('Next steps:');
      this.log('  • Run without --dry-run to create the baseline');
      this.log('  • Review requirements package before baselining');
      this.log('  • Ensure all stakeholders have approved\n');
    } else {
      this.log('Next steps:');
      this.log('  • Archive created in baselines/ directory');
      this.log('  • Tag can be referenced in future changes');
      this.log('  • Use for traceability and change control\n');
    }
  }
}
