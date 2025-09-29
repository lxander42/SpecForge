import { Command, Flags } from '@oclif/core';
import { logger } from '../services/telemetry/logger.js';
import { getWbsGeneratorService } from '../services/wbs/generator.js';
import { getRequirementsWriterService } from '../services/requirements/writer.js';
import { getAIService } from '../services/ai/provider.js';
import { getConfig } from '../lib/config.js';
import { SpecForgeError } from '../lib/errors.js';
import type { Discipline, Complexity, WbsItem, RequirementsPackage } from '../models/entities.js';

export interface PlanResult {
  success: boolean;
  project: {
    org?: string;
    repo?: string;
    disciplines: Discipline[];
    complexity: Complexity;
  };
  wbs: {
    itemsGenerated: number;
    aiAssistableItems: number;
    itemsByPhase: Record<string, number>;
    itemsByDiscipline: Record<string, number>;
  };
  requirements: {
    sectionsGenerated: number;
    totalRequirements: number;
    estimatedRequirements: Record<string, number>;
  };
  preview: boolean;
  duration: number;
}

export default class Plan extends Command {
  static override description = 'Generate or regenerate Work Breakdown Structure and requirements previews';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --disciplines Mechanical Electrical --complexity medium',
    '<%= config.bin %> <%= command.id %> --preview --json',
    '<%= config.bin %> <%= command.id %> --write --ai-prune',
  ];

  static override flags = {
    disciplines: Flags.string({
      char: 'd',
      description: 'Override project disciplines (Mechanical, Electrical, Firmware, Software)',
      multiple: true,
      options: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
    }),
    complexity: Flags.string({
      char: 'c',
      description: 'Override project complexity level',
      options: ['low', 'medium', 'high'],
    }),
    phases: Flags.string({
      description: 'Specific phases to include (comma-separated)',
      default: 'concept,prelim,detailed,critical,final',
    }),
    'ai-prune': Flags.boolean({
      description: 'Use AI to prune unnecessary tasks',
      default: false,
    }),
    'ai-hints': Flags.boolean({
      description: 'Include AI assistance hints',
      default: true,
    }),
    preview: Flags.boolean({
      description: 'Preview mode - show what would be generated without writing files',
      default: true,
    }),
    write: Flags.boolean({
      description: 'Write generated content to files (overrides preview mode)',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output results in JSON format',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Verbose output with detailed information',
      default: false,
    }),
    help: Flags.help({ char: 'h' }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Plan);
    const startTime = Date.now();

    try {
      logger.info('Starting plan generation', {
        preview: !flags.write,
        aiPrune: flags['ai-prune'],
        aiHints: flags['ai-hints'],
      });

      // Load project configuration
      const projectConfig = this.loadProjectConfiguration(flags);
      
      // Generate plan
      const result = await this.generatePlan(projectConfig, flags);
      result.duration = Date.now() - startTime;

      // Output results
      if (flags.json) {
        this.log(JSON.stringify(result, null, 2));
      } else {
        await this.displayResults(result, flags);
      }

      logger.info('Plan generation completed', {
        duration: result.duration,
        success: result.success,
        itemsGenerated: result.wbs.itemsGenerated,
      });

    } catch (error) {
      logger.error('Plan generation failed', { error: error instanceof Error ? error.message : String(error) }, error as Error);
      
      if (flags.json) {
        this.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        }, null, 2));
      } else {
        this.error(`Plan generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Load project configuration from config and flags
   */
  private loadProjectConfiguration(flags: any): {
    disciplines: Discipline[];
    complexity: Complexity;
    phases: string[];
    org?: string;
    repo?: string;
  } {
    const config = getConfig();
    
    // Get disciplines from flags or config
    let disciplines: Discipline[] = [];
    if (flags.disciplines) {
      disciplines = flags.disciplines as Discipline[];
    } else if (config.project?.disciplines) {
      disciplines = config.project.disciplines;
    } else {
      throw new SpecForgeError('No disciplines specified. Use --disciplines flag or run specforge init first.');
    }

    // Get complexity from flags or config
    let complexity: Complexity = 'medium';
    if (flags.complexity) {
      complexity = flags.complexity as Complexity;
    } else if (config.project?.complexity) {
      complexity = config.project.complexity;
    }

    // Parse phases
    const phases = flags.phases.split(',').map((p: string) => p.trim());

    return {
      disciplines,
      complexity,
      phases,
      org: config.project?.org || config.github?.org,
      repo: config.project?.repo || config.github?.repo,
    };
  }

  /**
   * Generate the plan (WBS + requirements preview)
   */
  private async generatePlan(
    projectConfig: {
      disciplines: Discipline[];
      complexity: Complexity;
      phases: string[];
      org?: string;
      repo?: string;
    },
    flags: any
  ): Promise<PlanResult> {
    const result: PlanResult = {
      success: false,
      project: {
        org: projectConfig.org,
        repo: projectConfig.repo,
        disciplines: projectConfig.disciplines,
        complexity: projectConfig.complexity,
      },
      wbs: {
        itemsGenerated: 0,
        aiAssistableItems: 0,
        itemsByPhase: {},
        itemsByDiscipline: {},
      },
      requirements: {
        sectionsGenerated: 0,
        totalRequirements: 0,
        estimatedRequirements: {},
      },
      preview: !flags.write,
      duration: 0,
    };

    try {
      // Step 1: Generate WBS
      const wbsItems = await this.generateWBS(projectConfig, flags, result);

      // Step 2: Generate requirements preview
      await this.generateRequirementsPreview(projectConfig, wbsItems, flags, result);

      // Step 3: Write files if requested
      if (flags.write) {
        await this.writeGeneratedContent(wbsItems, projectConfig, flags, result);
      }

      result.success = true;
      return result;

    } catch (error) {
      logger.error('Plan generation step failed', { step: 'unknown' }, error as Error);
      throw error;
    }
  }

  /**
   * Generate Work Breakdown Structure
   */
  private async generateWBS(
    projectConfig: {
      disciplines: Discipline[];
      complexity: Complexity;
      phases: string[];
    },
    flags: any,
    result: PlanResult
  ): Promise<WbsItem[]> {
    logger.info('Generating Work Breakdown Structure', {
      disciplines: projectConfig.disciplines,
      complexity: projectConfig.complexity,
      phases: projectConfig.phases,
    });

    try {
      const wbsService = getWbsGeneratorService();
      
      let wbsItems = wbsService.generateWbs({
        disciplines: projectConfig.disciplines,
        complexity: projectConfig.complexity,
        phases: projectConfig.phases as any[],
      }, {
        includeAiHints: flags['ai-hints'],
        pruneUnnecessaryTasks: flags['ai-prune'],
      });

      // Apply AI pruning if requested
      if (flags['ai-prune']) {
        wbsItems = await this.applyAIPruning(wbsItems, projectConfig);
      }

      // Calculate statistics
      result.wbs.itemsGenerated = wbsItems.length;
      result.wbs.aiAssistableItems = wbsItems.filter(item => item.aiAssistable).length;

      // Group by phase
      for (const item of wbsItems) {
        result.wbs.itemsByPhase[item.phase] = (result.wbs.itemsByPhase[item.phase] || 0) + 1;
      }

      // Group by discipline
      for (const item of wbsItems) {
        for (const discipline of item.disciplineTags) {
          result.wbs.itemsByDiscipline[discipline] = (result.wbs.itemsByDiscipline[discipline] || 0) + 1;
        }
      }

      logger.info('Generated WBS items', {
        total: result.wbs.itemsGenerated,
        aiAssistable: result.wbs.aiAssistableItems,
        byPhase: result.wbs.itemsByPhase,
      });

      return wbsItems;

    } catch (error) {
      throw new SpecForgeError('Failed to generate WBS', { cause: error });
    }
  }

  /**
   * Apply AI pruning to WBS items
   */
  private async applyAIPruning(
    wbsItems: WbsItem[],
    projectConfig: { disciplines: Discipline[]; complexity: Complexity }
  ): Promise<WbsItem[]> {
    logger.info('Applying AI pruning to WBS items');

    try {
      const aiService = getAIService();
      
      const checklistItems = wbsItems.map(item => `${item.id}: ${item.title}`);
      const pruningResult = await aiService.pruneChecklist(checklistItems, {
        disciplines: projectConfig.disciplines,
        complexity: projectConfig.complexity,
      });

      // Filter items based on AI recommendations
      const keepSet = new Set(pruningResult.keep.map(item => item.split(':')[0]));
      const prunedItems = wbsItems.filter(item => keepSet.has(item.id));

      logger.info('AI pruning completed', {
        original: wbsItems.length,
        kept: prunedItems.length,
        removed: wbsItems.length - prunedItems.length,
        rationale: pruningResult.rationale,
      });

      return prunedItems;

    } catch (error) {
      logger.warn('AI pruning failed, using original WBS items', { error: error instanceof Error ? error.message : String(error) });
      return wbsItems;
    }
  }

  /**
   * Generate requirements preview
   */
  private async generateRequirementsPreview(
    projectConfig: { disciplines: Discipline[]; complexity: Complexity },
    wbsItems: WbsItem[],
    flags: any,
    result: PlanResult
  ): Promise<void> {
    logger.info('Generating requirements preview');

    try {
      // Standard requirements sections
      const sections = [
        'functional',
        'performance',
        'environmental',
        'interfaces',
        'safety',
        'verification',
        'acceptance',
      ];

      result.requirements.sectionsGenerated = sections.length;

      // Estimate requirements based on WBS items and project complexity
      const baseRequirements = {
        functional: this.estimateRequirements('functional', wbsItems, projectConfig.complexity),
        performance: this.estimateRequirements('performance', wbsItems, projectConfig.complexity),
        environmental: this.estimateRequirements('environmental', wbsItems, projectConfig.complexity),
        interfaces: this.estimateRequirements('interfaces', wbsItems, projectConfig.complexity),
        safety: this.estimateRequirements('safety', wbsItems, projectConfig.complexity),
        verification: this.estimateRequirements('verification', wbsItems, projectConfig.complexity),
        acceptance: this.estimateRequirements('acceptance', wbsItems, projectConfig.complexity),
      };

      result.requirements.estimatedRequirements = baseRequirements;
      result.requirements.totalRequirements = Object.values(baseRequirements).reduce((sum, count) => sum + count, 0);

      logger.info('Generated requirements preview', {
        sections: result.requirements.sectionsGenerated,
        totalEstimated: result.requirements.totalRequirements,
        breakdown: result.requirements.estimatedRequirements,
      });

    } catch (error) {
      throw new SpecForgeError('Failed to generate requirements preview', { cause: error });
    }
  }

  /**
   * Estimate number of requirements for a section
   */
  private estimateRequirements(
    section: string,
    wbsItems: WbsItem[],
    complexity: Complexity
  ): number {
    const complexityMultiplier = {
      low: 1,
      medium: 1.5,
      high: 2,
    };

    const sectionBaseCount = {
      functional: Math.ceil(wbsItems.length * 0.3),
      performance: Math.ceil(wbsItems.length * 0.2),
      environmental: Math.ceil(wbsItems.length * 0.1),
      interfaces: Math.ceil(wbsItems.length * 0.15),
      safety: Math.ceil(wbsItems.length * 0.1),
      verification: Math.ceil(wbsItems.length * 0.1),
      acceptance: Math.ceil(wbsItems.length * 0.05),
    };

    const baseCount = sectionBaseCount[section as keyof typeof sectionBaseCount] || 5;
    return Math.max(1, Math.ceil(baseCount * complexityMultiplier[complexity]));
  }

  /**
   * Write generated content to files
   */
  private async writeGeneratedContent(
    wbsItems: WbsItem[],
    projectConfig: { disciplines: Discipline[]; complexity: Complexity },
    flags: any,
    result: PlanResult
  ): Promise<void> {
    if (result.preview) {
      logger.info('Skipping file writes in preview mode');
      return;
    }

    logger.info('Writing generated content to files');

    try {
      const requirementsService = getRequirementsWriterService();
      
      // Generate basic requirements package structure
      const requirementsPackage: RequirementsPackage = {
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

      logger.info('Generated content written to files');

    } catch (error) {
      throw new SpecForgeError('Failed to write generated content', { cause: error });
    }
  }

  /**
   * Display results in human-readable format
   */
  private async displayResults(result: PlanResult, flags: any): Promise<void> {
    if (result.preview) {
      this.log('\n📋 Plan Preview (no files written)\n');
    } else {
      this.log('\n📋 Plan Generated Successfully\n');
    }
    
    this.log('📋 Project Configuration:');
    if (result.project.org && result.project.repo) {
      this.log(`   Repository: ${result.project.org}/${result.project.repo}`);
    }
    this.log(`   Disciplines: ${result.project.disciplines.join(', ')}`);
    this.log(`   Complexity: ${result.project.complexity}\n`);
    
    this.log('🔧 Work Breakdown Structure:');
    this.log(`   Total Items: ${result.wbs.itemsGenerated}`);
    this.log(`   AI-Assistable: ${result.wbs.aiAssistableItems}`);
    
    if (flags.verbose) {
      this.log('   By Phase:');
      Object.entries(result.wbs.itemsByPhase).forEach(([phase, count]) => {
        this.log(`     ${phase}: ${count} items`);
      });
      
      this.log('   By Discipline:');
      Object.entries(result.wbs.itemsByDiscipline).forEach(([discipline, count]) => {
        this.log(`     ${discipline}: ${count} items`);
      });
    }
    this.log();
    
    this.log('📝 Requirements Preview:');
    this.log(`   Sections: ${result.requirements.sectionsGenerated}`);
    this.log(`   Estimated Total: ${result.requirements.totalRequirements} requirements`);
    
    if (flags.verbose) {
      this.log('   Breakdown:');
      Object.entries(result.requirements.estimatedRequirements).forEach(([section, count]) => {
        this.log(`     ${section}: ~${count} requirements`);
      });
    }
    this.log();
    
    this.log(`⏱️  Generated in ${result.duration}ms\n`);
    
    if (result.preview) {
      this.log('Next steps:');
      this.log('  • Run with --write to generate actual files');
      this.log('  • Use --ai-prune to optimize task list');
      this.log('  • Customize disciplines/complexity as needed\n');
    } else {
      this.log('Next steps:');
      this.log('  • Review generated requirements in requirements/');
      this.log('  • Run specforge init to create GitHub issues');
      this.log('  • Use specforge refactor to reconcile changes\n');
    }
  }
}
