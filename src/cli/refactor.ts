import { Command, Flags } from '@oclif/core';
import { z } from 'zod';
import { logger } from '../services/telemetry/logger.js';
import { getGitHubIssuesService } from '../services/github/issues.js';
import { getWbsGeneratorService } from '../services/wbs/generator.js';
import { getReconciliationService } from '../services/reconciliation/diff.js';
import { getConfig } from '../lib/config.js';
import { SpecForgeError } from '../lib/errors.js';
import type { Discipline, Complexity, WbsItem } from '../models/entities.js';

// Refactor command schema (matches refactor.schema.json)
const RefactorCommandSchema = z.object({
  org: z.string(),
  repo: z.string(),
  reconcile: z.boolean().optional(),
  prune: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  json: z.boolean().optional(),
});

type RefactorCommandArgs = z.infer<typeof RefactorCommandSchema>;

export interface RefactorResult {
  success: boolean;
  project: {
    org: string;
    repo: string;
    disciplines?: Discipline[];
    complexity?: Complexity;
  };
  reconciliation: {
    itemsAnalyzed: number;
    itemsAdded: number;
    itemsModified: number;
    itemsRemoved: number;
    itemsUnchanged: number;
    manualEditsPreserved: number;
  };
  github: {
    issuesCreated: number;
    issuesUpdated: number;
    issuesRemoved: number;
  };
  changes: Array<{
    type: 'added' | 'modified' | 'removed';
    item: string;
    description: string;
    preservedEdit?: boolean;
  }>;
  dryRun: boolean;
  duration: number;
}

export default class Refactor extends Command {
  static override description = 'Reconcile existing project state with current specifications';

  static override examples = [
    '<%= config.bin %> <%= command.id %> --org myorg --repo myproject',
    '<%= config.bin %> <%= command.id %> --org myorg --repo myproject --reconcile --prune',
    '<%= config.bin %> <%= command.id %> --org myorg --repo myproject --dry-run --json',
    '<%= config.bin %> <%= command.id %> --org myorg --repo myproject --reconcile --json',
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
    reconcile: Flags.boolean({
      description: 'Reconcile differences between current and desired state',
      default: false,
    }),
    prune: Flags.boolean({
      description: 'Remove items that are no longer needed',
      default: false,
    }),
    'preserve-edits': Flags.boolean({
      description: 'Preserve manual edits during reconciliation',
      default: true,
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would be changed without making changes',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output results in JSON format',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Verbose output with detailed change information',
      default: false,
    }),
    help: Flags.help({ char: 'h' }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Refactor);
    const startTime = Date.now();

    try {
      // Validate input against schema
      const validatedArgs = this.validateInput(flags);
      
      logger.info('Starting project refactor', {
        org: validatedArgs.org,
        repo: validatedArgs.repo,
        reconcile: validatedArgs.reconcile,
        prune: validatedArgs.prune,
        dryRun: validatedArgs.dryRun,
      });

      // Execute refactor
      const result = await this.refactorProject(validatedArgs, flags);
      result.duration = Date.now() - startTime;

      // Output results
      if (flags.json) {
        this.log(JSON.stringify(result, null, 2));
      } else {
        await this.displayResults(result, flags);
      }

      logger.info('Project refactor completed', {
        duration: result.duration,
        success: result.success,
        changes: result.changes.length,
      });

    } catch (error) {
      logger.error('Project refactor failed', { error: error instanceof Error ? error.message : String(error) }, error as Error);
      
      if (flags.json) {
        this.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        }, null, 2));
      } else {
        this.error(`Refactor failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Validate input arguments against schema
   */
  private validateInput(flags: any): RefactorCommandArgs {
    try {
      return RefactorCommandSchema.parse({
        org: flags.org,
        repo: flags.repo,
        reconcile: flags.reconcile,
        prune: flags.prune,
        dryRun: flags['dry-run'],
        json: flags.json,
      });
    } catch (error) {
      throw new SpecForgeError('Invalid input parameters', { cause: error });
    }
  }

  /**
   * Execute the refactor process
   */
  private async refactorProject(args: RefactorCommandArgs, flags: any): Promise<RefactorResult> {
    const result: RefactorResult = {
      success: false,
      project: {
        org: args.org,
        repo: args.repo,
      },
      reconciliation: {
        itemsAnalyzed: 0,
        itemsAdded: 0,
        itemsModified: 0,
        itemsRemoved: 0,
        itemsUnchanged: 0,
        manualEditsPreserved: 0,
      },
      github: {
        issuesCreated: 0,
        issuesUpdated: 0,
        issuesRemoved: 0,
      },
      changes: [],
      dryRun: args.dryRun || false,
      duration: 0,
    };

    try {
      // Step 1: Load project configuration
      const projectConfig = await this.loadProjectConfiguration(args, result);

      // Step 2: Get current state from GitHub
      const currentState = await this.getCurrentState(args, result);

      // Step 3: Generate desired state
      const desiredState = await this.generateDesiredState(projectConfig, result);

      // Step 4: Reconcile differences
      const reconciliation = await this.reconcileStates(currentState, desiredState, flags, result);

      // Step 5: Apply changes if not dry run
      if (!args.dryRun && (args.reconcile || args.prune)) {
        await this.applyChanges(args, reconciliation, flags, result);
      }

      result.success = true;
      return result;

    } catch (error) {
      logger.error('Refactor step failed', { step: 'unknown' }, error as Error);
      throw error;
    }
  }

  /**
   * Load project configuration
   */
  private async loadProjectConfiguration(
    args: RefactorCommandArgs,
    result: RefactorResult
  ): Promise<{
    disciplines: Discipline[];
    complexity: Complexity;
    phases: string[];
  }> {
    logger.info('Loading project configuration');

    try {
      const config = getConfig();
      
      const disciplines = config.project?.disciplines || ['Mechanical', 'Electrical'];
      const complexity = config.project?.complexity || 'medium';
      const phases = ['concept', 'prelim', 'detailed', 'critical', 'final'];

      result.project.disciplines = disciplines;
      result.project.complexity = complexity;

      logger.info('Loaded project configuration', {
        disciplines,
        complexity,
        phases: phases.length,
      });

      return { disciplines, complexity, phases };

    } catch (error) {
      throw new SpecForgeError('Failed to load project configuration', { cause: error });
    }
  }

  /**
   * Get current state from GitHub issues
   */
  private async getCurrentState(
    args: RefactorCommandArgs,
    result: RefactorResult
  ): Promise<WbsItem[]> {
    logger.info('Loading current state from GitHub', { org: args.org, repo: args.repo });

    try {
      const issuesService = getGitHubIssuesService();
      const issues = await issuesService.getIssues(args.org, args.repo, {
        state: 'all',
        labels: ['phase:', 'discipline:', 'complexity:'],
      });

      // Convert GitHub issues to WBS items
      const currentWbsItems: WbsItem[] = issues
        .filter(issue => this.isWbsIssue(issue))
        .map(issue => this.convertIssueToWbsItem(issue));

      result.reconciliation.itemsAnalyzed = currentWbsItems.length;

      logger.info('Loaded current state', {
        issues: issues.length,
        wbsItems: currentWbsItems.length,
      });

      return currentWbsItems;

    } catch (error) {
      throw new SpecForgeError('Failed to load current state from GitHub', { cause: error });
    }
  }

  /**
   * Generate desired state based on current configuration
   */
  private async generateDesiredState(
    projectConfig: {
      disciplines: Discipline[];
      complexity: Complexity;
      phases: string[];
    },
    result: RefactorResult
  ): Promise<WbsItem[]> {
    logger.info('Generating desired state');

    try {
      const wbsService = getWbsGeneratorService();
      const desiredWbsItems = wbsService.generateWbs({
        disciplines: projectConfig.disciplines,
        complexity: projectConfig.complexity,
        phases: projectConfig.phases as any[],
      }, {
        includeAiHints: true,
        pruneUnnecessaryTasks: true,
      });

      logger.info('Generated desired state', {
        items: desiredWbsItems.length,
      });

      return desiredWbsItems;

    } catch (error) {
      throw new SpecForgeError('Failed to generate desired state', { cause: error });
    }
  }

  /**
   * Reconcile current and desired states
   */
  private async reconcileStates(
    currentState: WbsItem[],
    desiredState: WbsItem[],
    flags: any,
    result: RefactorResult
  ): Promise<any> {
    logger.info('Reconciling current and desired states');

    try {
      const reconciliationService = getReconciliationService();
      
      const diff = reconciliationService.diffWbsItems(currentState, desiredState, {
        preserveManualEdits: flags['preserve-edits'],
        allowFieldUpdates: ['title', 'description', 'aiHint'],
        ignoreFields: ['templateId'],
      });

      // Update result statistics
      result.reconciliation.itemsAdded = diff.added.length;
      result.reconciliation.itemsModified = diff.modified.length;
      result.reconciliation.itemsRemoved = diff.removed.length;
      result.reconciliation.itemsUnchanged = diff.unchanged.length;

      // Generate change descriptions
      for (const item of diff.added) {
        result.changes.push({
          type: 'added',
          item: item.id,
          description: `Add new task: ${item.title}`,
        });
      }

      for (const change of diff.modified) {
        const changedFields = change.changes.join(', ');
        result.changes.push({
          type: 'modified',
          item: change.before.id,
          description: `Update ${changedFields}: ${change.after.title}`,
        });
      }

      for (const item of diff.removed) {
        result.changes.push({
          type: 'removed',
          item: item.id,
          description: `Remove task: ${item.title}`,
        });
      }

      logger.info('Reconciliation completed', {
        added: diff.added.length,
        modified: diff.modified.length,
        removed: diff.removed.length,
        unchanged: diff.unchanged.length,
      });

      return diff;

    } catch (error) {
      throw new SpecForgeError('Failed to reconcile states', { cause: error });
    }
  }

  /**
   * Apply changes to GitHub
   */
  private async applyChanges(
    args: RefactorCommandArgs,
    reconciliation: any,
    flags: any,
    result: RefactorResult
  ): Promise<void> {
    logger.info('Applying changes to GitHub');

    try {
      const issuesService = getGitHubIssuesService();

      // Create new issues for added items
      if (args.reconcile) {
        for (const item of reconciliation.added) {
          const issueOptions = {
            title: item.title,
            body: this.generateIssueBody(item),
            labels: this.generateIssueLabels(item),
            assignees: [],
          };

          await issuesService.createIssue(args.org, args.repo, issueOptions);
          result.github.issuesCreated++;
        }

        // Update existing issues for modified items
        for (const change of reconciliation.modified) {
          const issue = await issuesService.findIssueByTitle(args.org, args.repo, change.before.title);
          if (issue) {
            await issuesService.updateIssue(args.org, args.repo, issue.number, {
              title: change.after.title,
              body: this.generateIssueBody(change.after),
              labels: this.generateIssueLabels(change.after),
            });
            result.github.issuesUpdated++;
          }
        }
      }

      // Remove issues for removed items
      if (args.prune) {
        for (const item of reconciliation.removed) {
          const issue = await issuesService.findIssueByTitle(args.org, args.repo, item.title);
          if (issue) {
            await issuesService.closeIssue(args.org, args.repo, issue.number);
            result.github.issuesRemoved++;
          }
        }
      }

      logger.info('Applied changes to GitHub', {
        created: result.github.issuesCreated,
        updated: result.github.issuesUpdated,
        removed: result.github.issuesRemoved,
      });

    } catch (error) {
      throw new SpecForgeError('Failed to apply changes to GitHub', { cause: error });
    }
  }

  /**
   * Check if a GitHub issue represents a WBS item
   */
  private isWbsIssue(issue: any): boolean {
    const hasPhaseLabel = issue.labels.some((label: any) => 
      label.name.startsWith('phase:')
    );
    const hasDisciplineLabel = issue.labels.some((label: any) => 
      label.name.startsWith('discipline:')
    );
    
    return hasPhaseLabel && hasDisciplineLabel;
  }

  /**
   * Convert GitHub issue to WBS item
   */
  private convertIssueToWbsItem(issue: any): WbsItem {
    // Extract phase from labels
    const phaseLabel = issue.labels.find((label: any) => 
      label.name.startsWith('phase:')
    );
    const phase = phaseLabel?.name.replace('phase:', '') || 'concept';

    // Extract disciplines from labels
    const disciplineLabels = issue.labels.filter((label: any) => 
      label.name.startsWith('discipline:')
    );
    const disciplineTags = disciplineLabels.map((label: any) => 
      label.name.replace('discipline:', '').charAt(0).toUpperCase() + 
      label.name.replace('discipline:', '').slice(1)
    );

    // Extract AI assistable from labels
    const aiAssistable = issue.labels.some((label: any) => 
      label.name === 'ai-assistable'
    );

    // Extract priority from labels
    const priorityLabel = issue.labels.find((label: any) => 
      label.name.startsWith('priority:')
    );
    const priority = priorityLabel?.name.replace('priority:', '') || 'medium';

    return {
      id: `WBS-${issue.number.toString().padStart(3, '0')}`,
      title: issue.title,
      description: issue.body || undefined,
      phase: phase as any,
      disciplineTags: disciplineTags as Discipline[],
      aiAssistable,
      dependencies: [],
      priority: priority as any,
    };
  }

  /**
   * Generate issue body from WBS item
   */
  private generateIssueBody(wbsItem: WbsItem): string {
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
    
    body += `---\n*Updated by SpecForge*`;
    
    return body;
  }

  /**
   * Generate issue labels from WBS item
   */
  private generateIssueLabels(wbsItem: WbsItem): string[] {
    const labels: string[] = [];
    
    // Phase label
    labels.push(`phase:${wbsItem.phase}`);
    
    // Discipline labels
    wbsItem.disciplineTags.forEach((discipline: Discipline) => {
      labels.push(`discipline:${discipline.toLowerCase()}`);
    });
    
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
  private async displayResults(result: RefactorResult, flags: any): Promise<void> {
    if (result.dryRun) {
      this.log('\n🔍 Refactor Analysis (dry run - no changes made)\n');
    } else {
      this.log('\n🔧 Project Refactor Completed\n');
    }
    
    this.log('📋 Project Details:');
    this.log(`   Repository: ${result.project.org}/${result.project.repo}`);
    if (result.project.disciplines) {
      this.log(`   Disciplines: ${result.project.disciplines.join(', ')}`);
    }
    if (result.project.complexity) {
      this.log(`   Complexity: ${result.project.complexity}`);
    }
    this.log();
    
    this.log('🔄 Reconciliation Summary:');
    this.log(`   Items Analyzed: ${result.reconciliation.itemsAnalyzed}`);
    this.log(`   Items to Add: ${result.reconciliation.itemsAdded}`);
    this.log(`   Items to Modify: ${result.reconciliation.itemsModified}`);
    this.log(`   Items to Remove: ${result.reconciliation.itemsRemoved}`);
    this.log(`   Items Unchanged: ${result.reconciliation.itemsUnchanged}`);
    if (result.reconciliation.manualEditsPreserved > 0) {
      this.log(`   Manual Edits Preserved: ${result.reconciliation.manualEditsPreserved}`);
    }
    this.log();
    
    if (!result.dryRun) {
      this.log('🐙 GitHub Changes:');
      this.log(`   Issues Created: ${result.github.issuesCreated}`);
      this.log(`   Issues Updated: ${result.github.issuesUpdated}`);
      this.log(`   Issues Removed: ${result.github.issuesRemoved}`);
      this.log();
    }
    
    if (result.changes.length > 0 && flags.verbose) {
      this.log('📝 Detailed Changes:');
      result.changes.forEach(change => {
        const icon = {
          added: '➕',
          modified: '✏️',
          removed: '➖',
        }[change.type];
        
        this.log(`   ${icon} ${change.description}`);
        if (change.preservedEdit) {
          this.log('     (manual edit preserved)');
        }
      });
      this.log();
    }
    
    this.log(`⏱️  Completed in ${result.duration}ms\n`);
    
    if (result.dryRun) {
      this.log('Next steps:');
      this.log('  • Run without --dry-run to apply changes');
      this.log('  • Use --reconcile to add/update items');
      this.log('  • Use --prune to remove obsolete items\n');
    } else {
      this.log('Next steps:');
      this.log('  • Review updated issues in GitHub');
      this.log('  • Run specforge plan to regenerate requirements');
      this.log('  • Use specforge baseline to create snapshots\n');
    }
  }
}
