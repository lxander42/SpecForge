import { Command, Flags } from '@oclif/core';
import { logger } from '../services/telemetry/logger.js';
import { getGitHubLabelsService } from '../services/github/labels.js';
import { getGitHubMilestonesService } from '../services/github/milestones.js';
import { getGitHubProjectsService } from '../services/github/projects.js';
import { getConfig } from '../lib/config.js';
import { SpecForgeError } from '../lib/errors.js';

export interface LabelsResult {
  success: boolean;
  repository: {
    org: string;
    repo: string;
  };
  labels: {
    created: number;
    updated: number;
    total: number;
    skipped: number;
  };
  milestones: {
    created: number;
    updated: number;
    total: number;
    skipped: number;
  };
  projects: {
    created: number;
    updated: number;
    total: number;
    skipped: number;
  };
  dryRun: boolean;
  duration: number;
}

export default class Labels extends Command {
  static override description = 'Ensure standard labels, milestones, and projects exist in GitHub repository';

  static override examples = [
    '<%= config.bin %> <%= command.id %> --org myorg --repo myproject',
    '<%= config.bin %> <%= command.id %> --org myorg --repo myproject --labels-only',
    '<%= config.bin %> <%= command.id %> --org myorg --repo myproject --dry-run --json',
    '<%= config.bin %> <%= command.id %> --org myorg --repo myproject --force-update',
  ];

  static override flags = {
    org: Flags.string({
      char: 'o',
      description: 'GitHub organization or user name',
      required: false,
    }),
    repo: Flags.string({
      char: 'r',
      description: 'GitHub repository name',
      required: false,
    }),
    'labels-only': Flags.boolean({
      description: 'Only create/update labels, skip milestones and projects',
      default: false,
    }),
    'milestones-only': Flags.boolean({
      description: 'Only create/update milestones, skip labels and projects',
      default: false,
    }),
    'projects-only': Flags.boolean({
      description: 'Only create/update projects, skip labels and milestones',
      default: false,
    }),
    'force-update': Flags.boolean({
      description: 'Force update existing labels/milestones even if they match',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would be created/updated without making changes',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output results in JSON format',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Verbose output with detailed information about each item',
      default: false,
    }),
    help: Flags.help({ char: 'h' }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Labels);
    const startTime = Date.now();

    try {
      // Get org/repo from flags or config
      const { org, repo } = this.getOrgRepo(flags);
      
      logger.info('Starting labels/milestones/projects setup', {
        org,
        repo,
        labelsOnly: flags['labels-only'],
        milestonesOnly: flags['milestones-only'],
        projectsOnly: flags['projects-only'],
        dryRun: flags['dry-run'],
      });

      // Setup GitHub resources
      const result = await this.setupGitHubResources(org, repo, flags);
      result.duration = Date.now() - startTime;

      // Output results
      if (flags.json) {
        this.log(JSON.stringify(result, null, 2));
      } else {
        await this.displayResults(result, flags);
      }

      logger.info('Labels/milestones/projects setup completed', {
        duration: result.duration,
        success: result.success,
        labelsCreated: result.labels.created,
        milestonesCreated: result.milestones.created,
        projectsCreated: result.projects.created,
      });

    } catch (error) {
      logger.error('Labels/milestones/projects setup failed', { 
        error: error instanceof Error ? error.message : String(error) 
      }, error as Error);
      
      if (flags.json) {
        this.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        }, null, 2));
      } else {
        this.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Get org/repo from flags or config
   */
  private getOrgRepo(flags: any): { org: string; repo: string } {
    const config = getConfig();
    
    const org = flags.org || config.github?.org || config.project?.org;
    const repo = flags.repo || config.github?.repo || config.project?.repo;

    if (!org) {
      throw new SpecForgeError('Organization is required. Use --org flag or configure via specforge init.');
    }

    if (!repo) {
      throw new SpecForgeError('Repository is required. Use --repo flag or configure via specforge init.');
    }

    return { org, repo };
  }

  /**
   * Setup GitHub resources (labels, milestones, projects)
   */
  private async setupGitHubResources(
    org: string,
    repo: string,
    flags: any
  ): Promise<LabelsResult> {
    const result: LabelsResult = {
      success: false,
      repository: { org, repo },
      labels: { created: 0, updated: 0, total: 0, skipped: 0 },
      milestones: { created: 0, updated: 0, total: 0, skipped: 0 },
      projects: { created: 0, updated: 0, total: 0, skipped: 0 },
      dryRun: flags['dry-run'],
      duration: 0,
    };

    try {
      // Setup labels
      if (!flags['milestones-only'] && !flags['projects-only']) {
        await this.setupLabels(org, repo, flags, result);
      }

      // Setup milestones
      if (!flags['labels-only'] && !flags['projects-only']) {
        await this.setupMilestones(org, repo, flags, result);
      }

      // Setup projects
      if (!flags['labels-only'] && !flags['milestones-only']) {
        await this.setupProjects(org, repo, flags, result);
      }

      result.success = true;
      return result;

    } catch (error) {
      throw new SpecForgeError('Failed to setup GitHub resources', { cause: error });
    }
  }

  /**
   * Setup GitHub labels
   */
  private async setupLabels(
    org: string,
    repo: string,
    flags: any,
    result: LabelsResult
  ): Promise<void> {
    logger.info('Setting up GitHub labels', { org, repo });

    try {
      const labelsService = getGitHubLabelsService();
      const standardLabels = labelsService.getStandardLabels();
      
      result.labels.total = standardLabels.length;

      if (flags['dry-run']) {
        logger.info('[DRY RUN] Would ensure standard labels exist');
        result.labels.created = standardLabels.length; // Estimate
        return;
      }

      // Get existing labels
      const existingLabels = await labelsService.getLabels(org, repo);
      const existingLabelNames = new Set(existingLabels.map(l => l.name));

      // Process each standard label
      for (const labelSpec of standardLabels) {
        if (existingLabelNames.has(labelSpec.name)) {
          const existingLabel = existingLabels.find(l => l.name === labelSpec.name);
          
          // Check if update is needed
          if (flags['force-update'] || 
              existingLabel?.color !== labelSpec.color ||
              existingLabel?.description !== labelSpec.description) {
            
            await labelsService.updateLabel(org, repo, labelSpec.name, {
              color: labelSpec.color,
              description: labelSpec.description,
            });
            result.labels.updated++;
            
            if (flags.verbose) {
              logger.info(`Updated label: ${labelSpec.name}`);
            }
          } else {
            result.labels.skipped++;
            if (flags.verbose) {
              logger.debug(`Skipped label (up to date): ${labelSpec.name}`);
            }
          }
        } else {
          await labelsService.createLabel(org, repo, labelSpec);
          result.labels.created++;
          
          if (flags.verbose) {
            logger.info(`Created label: ${labelSpec.name}`);
          }
        }
      }

      logger.info('Labels setup completed', {
        created: result.labels.created,
        updated: result.labels.updated,
        skipped: result.labels.skipped,
      });

    } catch (error) {
      throw new SpecForgeError('Failed to setup labels', { cause: error });
    }
  }

  /**
   * Setup GitHub milestones
   */
  private async setupMilestones(
    org: string,
    repo: string,
    flags: any,
    result: LabelsResult
  ): Promise<void> {
    logger.info('Setting up GitHub milestones', { org, repo });

    try {
      const milestonesService = getGitHubMilestonesService();
      const standardMilestones = milestonesService.getStandardMilestones();
      
      result.milestones.total = standardMilestones.length;

      if (flags['dry-run']) {
        logger.info('[DRY RUN] Would ensure standard milestones exist');
        result.milestones.created = standardMilestones.length; // Estimate
        return;
      }

      // Get existing milestones
      const existingMilestones = await milestonesService.getMilestones(org, repo);
      const existingMilestoneNames = new Set(existingMilestones.map(m => m.title));

      // Process each standard milestone
      for (const milestoneSpec of standardMilestones) {
        if (existingMilestoneNames.has(milestoneSpec.title)) {
          const existingMilestone = existingMilestones.find(m => m.title === milestoneSpec.title);
          
          // Check if update is needed
          if (flags['force-update'] || 
              existingMilestone?.description !== milestoneSpec.description ||
              existingMilestone?.state !== (milestoneSpec.state || 'open')) {
            
            await milestonesService.updateMilestone(org, repo, existingMilestone!.number, {
              description: milestoneSpec.description,
              state: milestoneSpec.state || 'open',
            });
            result.milestones.updated++;
            
            if (flags.verbose) {
              logger.info(`Updated milestone: ${milestoneSpec.title}`);
            }
          } else {
            result.milestones.skipped++;
            if (flags.verbose) {
              logger.debug(`Skipped milestone (up to date): ${milestoneSpec.title}`);
            }
          }
        } else {
          await milestonesService.createMilestone(org, repo, milestoneSpec);
          result.milestones.created++;
          
          if (flags.verbose) {
            logger.info(`Created milestone: ${milestoneSpec.title}`);
          }
        }
      }

      logger.info('Milestones setup completed', {
        created: result.milestones.created,
        updated: result.milestones.updated,
        skipped: result.milestones.skipped,
      });

    } catch (error) {
      throw new SpecForgeError('Failed to setup milestones', { cause: error });
    }
  }

  /**
   * Setup GitHub projects
   */
  private async setupProjects(
    org: string,
    repo: string,
    flags: any,
    result: LabelsResult
  ): Promise<void> {
    logger.info('Setting up GitHub projects', { org, repo });

    try {
      const projectsService = getGitHubProjectsService();
      const projectTitle = `${repo} Hardware Project`;
      
      result.projects.total = 1; // We create one main project

      if (flags['dry-run']) {
        logger.info('[DRY RUN] Would ensure project board exists');
        result.projects.created = 1; // Estimate
        return;
      }

      // Check if project exists
      const existingProject = await projectsService.findProject(org, projectTitle, true);

      if (existingProject) {
        // Check if update is needed
        const expectedDescription = `Hardware project tracking for ${repo}`;
        
        if (flags['force-update'] || 
            existingProject.shortDescription !== expectedDescription) {
          
          await projectsService.updateProject(existingProject.id, {
            shortDescription: expectedDescription,
          });
          result.projects.updated++;
          
          if (flags.verbose) {
            logger.info(`Updated project: ${projectTitle}`);
          }
        } else {
          result.projects.skipped++;
          if (flags.verbose) {
            logger.debug(`Skipped project (up to date): ${projectTitle}`);
          }
        }
      } else {
        await projectsService.createOrgProject(org, {
          title: projectTitle,
          shortDescription: `Hardware project tracking for ${repo}`,
          public: false,
        });
        result.projects.created++;
        
        if (flags.verbose) {
          logger.info(`Created project: ${projectTitle}`);
        }
      }

      logger.info('Projects setup completed', {
        created: result.projects.created,
        updated: result.projects.updated,
        skipped: result.projects.skipped,
      });

    } catch (error) {
      throw new SpecForgeError('Failed to setup projects', { cause: error });
    }
  }

  /**
   * Display results in human-readable format
   */
  private async displayResults(result: LabelsResult, flags: any): Promise<void> {
    if (result.dryRun) {
      this.log('\n🏷️  GitHub Resources Preview (dry run - no changes made)\n');
    } else {
      this.log('\n✅ GitHub Resources Setup Completed\n');
    }
    
    this.log('📋 Repository:');
    this.log(`   ${result.repository.org}/${result.repository.repo}\n`);
    
    // Labels section
    if (!flags['milestones-only'] && !flags['projects-only']) {
      this.log('🏷️  Labels:');
      this.log(`   Total Standard Labels: ${result.labels.total}`);
      this.log(`   Created: ${result.labels.created}`);
      this.log(`   Updated: ${result.labels.updated}`);
      this.log(`   Skipped (up to date): ${result.labels.skipped}`);
      this.log();
    }
    
    // Milestones section
    if (!flags['labels-only'] && !flags['projects-only']) {
      this.log('🎯 Milestones:');
      this.log(`   Total Standard Milestones: ${result.milestones.total}`);
      this.log(`   Created: ${result.milestones.created}`);
      this.log(`   Updated: ${result.milestones.updated}`);
      this.log(`   Skipped (up to date): ${result.milestones.skipped}`);
      this.log();
    }
    
    // Projects section
    if (!flags['labels-only'] && !flags['milestones-only']) {
      this.log('📊 Projects:');
      this.log(`   Total Projects: ${result.projects.total}`);
      this.log(`   Created: ${result.projects.created}`);
      this.log(`   Updated: ${result.projects.updated}`);
      this.log(`   Skipped (up to date): ${result.projects.skipped}`);
      this.log();
    }
    
    this.log(`⏱️  Completed in ${result.duration}ms\n`);
    
    if (result.dryRun) {
      this.log('Next steps:');
      this.log('  • Run without --dry-run to create the resources');
      this.log('  • Use --force-update to update existing items');
      this.log('  • Use --verbose for detailed output\n');
    } else {
      this.log('Next steps:');
      this.log('  • Resources are now ready for project management');
      this.log('  • Run specforge init to create initial issues');
      this.log('  • Use specforge plan to generate WBS items\n');
    }
  }
}
