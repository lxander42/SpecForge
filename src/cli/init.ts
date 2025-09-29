import { Command, Flags } from '@oclif/core';
import { z } from 'zod';
import { logger } from '../services/telemetry/logger.js';
import { getGitHubLabelsService } from '../services/github/labels.js';
import { getGitHubMilestonesService } from '../services/github/milestones.js';
import { getGitHubProjectsService } from '../services/github/projects.js';
import { getGitHubIssuesService } from '../services/github/issues.js';
import { getWbsGeneratorService } from '../services/wbs/generator.js';
import { getRequirementsWriterService } from '../services/requirements/writer.js';
import { getAIService } from '../services/ai/provider.js';
import { getConfig, setConfigValue } from '../lib/config.js';
import { displaySplash } from '../lib/ascii.js';
import { SpecForgeError } from '../lib/errors.js';
import { DisciplineEnum, ComplexityEnum } from '../models/entities.js';
import type { Discipline, Complexity } from '../models/entities.js';

// Init command schema (matches init.schema.json)
const InitCommandSchema = z.object({
  org: z.string(),
  repo: z.string(),
  disciplines: z.array(DisciplineEnum).min(1),
  complexity: ComplexityEnum,
  aiProvider: z.string().optional(),
  dryRun: z.boolean().optional(),
  json: z.boolean().optional(),
});

type InitCommandArgs = z.infer<typeof InitCommandSchema>;

export interface InitResult {
  success: boolean;
  project: {
    org: string;
    repo: string;
    disciplines: Discipline[];
    complexity: Complexity;
  };
  created: {
    labels: number;
    milestones: number;
    projects: number;
    issues: number;
  };
  requirements: {
    packagesCreated: number;
    sectionsGenerated: number;
  };
  wbs: {
    itemsGenerated: number;
    aiAssistableItems: number;
  };
  dryRun: boolean;
  duration: number;
}

export default class Init extends Command {
  static override description = 'Initialize a new hardware project with GitHub integration and requirements scaffolding';

  static override examples = [
    '<%= config.bin %> <%= command.id %> --org myorg --repo myproject --disciplines Mechanical Electrical --complexity medium',
    '<%= config.bin %> <%= command.id %> --org myorg --repo myproject --disciplines Firmware Software --complexity high --dry-run',
    '<%= config.bin %> <%= command.id %> --org myorg --repo myproject --disciplines Mechanical --complexity low --json',
  ];

  static override flags = {
    org: Flags.string({
      char: 'o',
      description: 'GitHub organization or user name',
      required: true,
    }),
    repo: Flags.string({
      char: 'r',
      description: 'GitHub repository name',
      required: true,
    }),
    disciplines: Flags.string({
      char: 'd',
      description: 'Project disciplines (Mechanical, Electrical, Firmware, Software)',
      multiple: true,
      required: true,
      options: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
    }),
    complexity: Flags.string({
      char: 'c',
      description: 'Project complexity level',
      required: true,
      options: ['low', 'medium', 'high'],
    }),
    'ai-provider': Flags.string({
      description: 'AI provider to use (openai, anthropic, mock)',
      default: 'mock',
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would be created without making changes',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output results in JSON format',
      default: false,
    }),
    help: Flags.help({ char: 'h' }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const startTime = Date.now();

    try {
      // Display splash animation (unless JSON output)
      if (!flags.json) {
        await displaySplash();
      }

      // Validate input against schema
      const validatedArgs = this.validateInput(flags);
      
      logger.info('Starting project initialization', {
        org: validatedArgs.org,
        repo: validatedArgs.repo,
        disciplines: validatedArgs.disciplines,
        complexity: validatedArgs.complexity,
        dryRun: validatedArgs.dryRun,
      });

      // Initialize project
      const result = await this.initializeProject(validatedArgs);
      result.duration = Date.now() - startTime;

      // Output results
      if (flags.json) {
        this.log(JSON.stringify(result, null, 2));
      } else {
        await this.displayResults(result);
      }

      logger.info('Project initialization completed', {
        duration: result.duration,
        success: result.success,
      });

    } catch (error) {
      logger.error('Project initialization failed', { error: error instanceof Error ? error.message : String(error) }, error as Error);
      
      if (flags.json) {
        this.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        }, null, 2));
      } else {
        this.error(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Validate input arguments against schema
   */
  private validateInput(flags: any): InitCommandArgs {
    try {
      return InitCommandSchema.parse({
        org: flags.org,
        repo: flags.repo,
        disciplines: flags.disciplines,
        complexity: flags.complexity,
        aiProvider: flags['ai-provider'],
        dryRun: flags['dry-run'],
        json: flags.json,
      });
    } catch (error) {
      throw new SpecForgeError('Invalid input parameters', { cause: error });
    }
  }

  /**
   * Initialize the project
   */
  private async initializeProject(args: InitCommandArgs): Promise<InitResult> {
    const result: InitResult = {
      success: false,
      project: {
        org: args.org,
        repo: args.repo,
        disciplines: args.disciplines,
        complexity: args.complexity,
      },
      created: {
        labels: 0,
        milestones: 0,
        projects: 0,
        issues: 0,
      },
      requirements: {
        packagesCreated: 0,
        sectionsGenerated: 0,
      },
      wbs: {
        itemsGenerated: 0,
        aiAssistableItems: 0,
      },
      dryRun: args.dryRun || false,
      duration: 0,
    };

    try {
      // Step 1: Setup GitHub resources
      await this.setupGitHubResources(args, result);

      // Step 2: Generate WBS
      await this.generateWBS(args, result);

      // Step 3: Create GitHub issues from WBS
      await this.createGitHubIssues(args, result);

      // Step 4: Generate requirements package
      await this.generateRequirementsPackage(args, result);

      // Step 5: Save project configuration
      await this.saveProjectConfiguration(args, result);

      result.success = true;
      return result;

    } catch (error) {
      logger.error('Project initialization step failed', { step: 'unknown' }, error as Error);
      throw error;
    }
  }

  /**
   * Setup GitHub resources (labels, milestones, projects)
   */
  private async setupGitHubResources(args: InitCommandArgs, result: InitResult): Promise<void> {
    logger.info('Setting up GitHub resources', { org: args.org, repo: args.repo });

    if (args.dryRun) {
      logger.info('[DRY RUN] Would create GitHub labels, milestones, and projects');
      result.created.labels = 15; // Estimated
      result.created.milestones = 5;
      result.created.projects = 1;
      return;
    }

    try {
      // Create standard labels
      const labelsService = getGitHubLabelsService();
      const standardLabels = labelsService.getStandardLabels();
      const createdLabels = await labelsService.ensureLabels(args.org, args.repo, standardLabels);
      result.created.labels = createdLabels.length;
      
      logger.info('Created/ensured labels', { count: result.created.labels });

      // Create standard milestones
      const milestonesService = getGitHubMilestonesService();
      const standardMilestones = milestonesService.getStandardMilestones();
      const createdMilestones = await milestonesService.ensureMilestones(args.org, args.repo, standardMilestones);
      result.created.milestones = createdMilestones.length;
      
      logger.info('Created/ensured milestones', { count: result.created.milestones });

      // Create project board
      const projectsService = getGitHubProjectsService();
      const projectTitle = `${args.repo} Hardware Project`;
      const project = await projectsService.ensureProject(args.org, projectTitle, {
        title: projectTitle,
        shortDescription: `Hardware project tracking for ${args.repo}`,
        public: false,
      });
      
      if (project) {
        result.created.projects = 1;
        logger.info('Created/ensured project board', { title: projectTitle });
      }

    } catch (error) {
      throw new SpecForgeError('Failed to setup GitHub resources', { cause: error });
    }
  }

  /**
   * Generate Work Breakdown Structure
   */
  private async generateWBS(args: InitCommandArgs, result: InitResult): Promise<void> {
    logger.info('Generating Work Breakdown Structure', {
      disciplines: args.disciplines,
      complexity: args.complexity,
    });

    try {
      const wbsService = getWbsGeneratorService();
      const wbsItems = wbsService.generateWbs({
        disciplines: args.disciplines,
        complexity: args.complexity,
        phases: ['concept', 'prelim', 'detailed', 'critical', 'final'],
      }, {
        includeAiHints: true,
        pruneUnnecessaryTasks: true,
      });

      result.wbs.itemsGenerated = wbsItems.length;
      result.wbs.aiAssistableItems = wbsItems.filter(item => item.aiAssistable).length;

      logger.info('Generated WBS items', {
        total: result.wbs.itemsGenerated,
        aiAssistable: result.wbs.aiAssistableItems,
      });

      // Store WBS items for issue creation
      (result as any)._wbsItems = wbsItems;

    } catch (error) {
      throw new SpecForgeError('Failed to generate WBS', { cause: error });
    }
  }

  /**
   * Create GitHub issues from WBS items
   */
  private async createGitHubIssues(args: InitCommandArgs, result: InitResult): Promise<void> {
    const wbsItems = (result as any)._wbsItems || [];
    
    if (wbsItems.length === 0) {
      logger.warn('No WBS items to create issues from');
      return;
    }

    logger.info('Creating GitHub issues from WBS', { itemCount: wbsItems.length });

    if (args.dryRun) {
      logger.info('[DRY RUN] Would create GitHub issues from WBS items');
      result.created.issues = wbsItems.length;
      return;
    }

    try {
      const issuesService = getGitHubIssuesService();
      const issueOptions = wbsItems.map((item: any) => ({
        title: item.title,
        body: this.generateIssueBody(item),
        labels: this.generateIssueLabels(item, args.disciplines, args.complexity),
        assignees: [],
      }));

      const createdIssues = await issuesService.createIssues(args.org, args.repo, issueOptions);
      result.created.issues = createdIssues.length;

      logger.info('Created GitHub issues', { count: result.created.issues });

    } catch (error) {
      throw new SpecForgeError('Failed to create GitHub issues', { cause: error });
    }
  }

  /**
   * Generate requirements package
   */
  private async generateRequirementsPackage(args: InitCommandArgs, result: InitResult): Promise<void> {
    logger.info('Generating requirements package');

    if (args.dryRun) {
      logger.info('[DRY RUN] Would generate requirements package');
      result.requirements.packagesCreated = 1;
      result.requirements.sectionsGenerated = 7; // Standard sections
      return;
    }

    try {
      const requirementsService = getRequirementsWriterService();
      
      // Generate basic requirements package structure
      const requirementsPackage = {
        path: 'requirements',
        version: '0.1.0',
        sections: {
          functional: {
            title: 'Functional Requirements',
            description: 'System functional requirements and capabilities',
            requirements: [],
            order: 1,
          },
          performance: {
            title: 'Performance Requirements',
            description: 'System performance specifications and constraints',
            requirements: [],
            order: 2,
          },
          environmental: {
            title: 'Environmental Requirements',
            description: 'Environmental conditions and constraints',
            requirements: [],
            order: 3,
          },
          interfaces: {
            title: 'Interface Requirements',
            description: 'System interfaces and integration points',
            requirements: [],
            order: 4,
          },
          safety: {
            title: 'Safety Requirements',
            description: 'Safety requirements and compliance standards',
            requirements: [],
            order: 5,
          },
          verification: {
            title: 'Verification Requirements',
            description: 'Verification methods and test procedures',
            requirements: [],
            order: 6,
          },
          acceptance: {
            title: 'Acceptance Criteria',
            description: 'System acceptance criteria and sign-off requirements',
            requirements: [],
            order: 7,
          },
        },
      };

      await requirementsService.writeRequirementsPackage(requirementsPackage);
      
      result.requirements.packagesCreated = 1;
      result.requirements.sectionsGenerated = Object.keys(requirementsPackage.sections).length;

      logger.info('Generated requirements package', {
        sections: result.requirements.sectionsGenerated,
      });

    } catch (error) {
      throw new SpecForgeError('Failed to generate requirements package', { cause: error });
    }
  }

  /**
   * Save project configuration
   */
  private async saveProjectConfiguration(args: InitCommandArgs, result: InitResult): Promise<void> {
    if (args.dryRun) {
      logger.info('[DRY RUN] Would save project configuration');
      return;
    }

    try {
      setConfigValue('project.org', args.org);
      setConfigValue('project.repo', args.repo);
      setConfigValue('project.disciplines', args.disciplines);
      setConfigValue('project.complexity', args.complexity);
      setConfigValue('project.initialized', true);
      setConfigValue('project.initializedAt', new Date().toISOString());

      logger.info('Saved project configuration');

    } catch (error) {
      throw new SpecForgeError('Failed to save project configuration', { cause: error });
    }
  }

  /**
   * Generate issue body from WBS item
   */
  private generateIssueBody(wbsItem: any): string {
    let body = `## Description\n\n${wbsItem.description || wbsItem.title}\n\n`;
    
    body += `## Phase\n\n${wbsItem.phase.charAt(0).toUpperCase() + wbsItem.phase.slice(1)}\n\n`;
    
    body += `## Disciplines\n\n${wbsItem.disciplineTags.join(', ')}\n\n`;
    
    if (wbsItem.estimatedHours) {
      body += `## Estimated Effort\n\n${wbsItem.estimatedHours} hours\n\n`;
    }
    
    if (wbsItem.dependencies && wbsItem.dependencies.length > 0) {
      body += `## Dependencies\n\n${wbsItem.dependencies.map((dep: string) => `- ${dep}`).join('\n')}\n\n`;
    }
    
    if (wbsItem.aiAssistable && wbsItem.aiHint) {
      body += `## AI Assistance\n\n✅ This task can be AI-assisted\n\n**Hint**: ${wbsItem.aiHint}\n\n`;
    } else if (!wbsItem.aiAssistable) {
      body += `## AI Assistance\n\n❌ This task requires human expertise only\n\n`;
    }
    
    body += `---\n*Generated by SpecForge*`;
    
    return body;
  }

  /**
   * Generate issue labels from WBS item
   */
  private generateIssueLabels(wbsItem: any, disciplines: Discipline[], complexity: Complexity): string[] {
    const labels: string[] = [];
    
    // Phase label
    labels.push(`phase:${wbsItem.phase}`);
    
    // Discipline labels
    wbsItem.disciplineTags.forEach((discipline: Discipline) => {
      labels.push(`discipline:${discipline.toLowerCase()}`);
    });
    
    // Complexity label
    labels.push(`complexity:${complexity}`);
    
    // Priority label
    labels.push(`priority:${wbsItem.priority}`);
    
    // AI assistance label
    if (wbsItem.aiAssistable) {
      labels.push('ai-assistable');
    } else {
      labels.push('human-only');
    }
    
    return labels;
  }

  /**
   * Display results in human-readable format
   */
  private async displayResults(result: InitResult): Promise<void> {
    this.log('\n🎉 Project initialization completed successfully!\n');
    
    this.log('📋 Project Details:');
    this.log(`   Organization: ${result.project.org}`);
    this.log(`   Repository: ${result.project.repo}`);
    this.log(`   Disciplines: ${result.project.disciplines.join(', ')}`);
    this.log(`   Complexity: ${result.project.complexity}\n`);
    
    this.log('🏗️  GitHub Resources Created:');
    this.log(`   Labels: ${result.created.labels}`);
    this.log(`   Milestones: ${result.created.milestones}`);
    this.log(`   Projects: ${result.created.projects}`);
    this.log(`   Issues: ${result.created.issues}\n`);
    
    this.log('📝 Requirements Package:');
    this.log(`   Packages Created: ${result.requirements.packagesCreated}`);
    this.log(`   Sections Generated: ${result.requirements.sectionsGenerated}\n`);
    
    this.log('🔧 Work Breakdown Structure:');
    this.log(`   Items Generated: ${result.wbs.itemsGenerated}`);
    this.log(`   AI-Assistable Items: ${result.wbs.aiAssistableItems}\n`);
    
    if (result.dryRun) {
      this.log('ℹ️  This was a dry run - no actual changes were made.\n');
    }
    
    this.log(`⏱️  Completed in ${result.duration}ms\n`);
    
    this.log('Next steps:');
    this.log('  1. Review the generated issues in GitHub');
    this.log('  2. Customize the requirements package as needed');
    this.log('  3. Run `specforge plan` to regenerate WBS if needed');
    this.log('  4. Use `specforge refactor` to reconcile changes\n');
  }
}
