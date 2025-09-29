import { WbsItem } from '../../models/entities.js';
import { logger } from '../telemetry/logger.js';
import { SpecForgeError } from '../../lib/errors.js';

export type Phase = 'concept' | 'prelim' | 'detailed' | 'critical' | 'final';
export type Discipline = 'Mechanical' | 'Electrical' | 'Firmware' | 'Software';
export type Complexity = 'low' | 'medium' | 'high';

export interface ProjectContext {
  disciplines: Discipline[];
  complexity: Complexity;
  phases: Phase[];
}

export interface WbsGenerationOptions {
  includeAiHints?: boolean;
  pruneUnnecessaryTasks?: boolean;
  customTemplates?: Record<string, WbsTemplate>;
}

export interface WbsTemplate {
  title: string;
  description: string;
  phase: Phase;
  disciplines: Discipline[];
  complexity: Complexity[];
  aiAssistable: boolean;
  aiHint?: string;
  dependencies?: string[];
  estimatedHours?: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export class WbsGeneratorService {
  private templates: Record<string, WbsTemplate> = {};

  constructor() {
    this.initializeStandardTemplates();
  }

  /**
   * Generate WBS items for a project based on context
   */
  generateWbs(context: ProjectContext, options: WbsGenerationOptions = {}): WbsItem[] {
    logger.info('Generating WBS for project', { 
      disciplines: context.disciplines, 
      complexity: context.complexity,
      phases: context.phases.length,
    });

    const wbsItems: WbsItem[] = [];
    let itemCounter = 1;

    // Merge custom templates if provided
    const allTemplates = { ...this.templates, ...(options.customTemplates || {}) };

    for (const phase of context.phases) {
      const phaseTemplates = Object.entries(allTemplates)
        .filter(([_, template]) => template.phase === phase)
        .filter(([_, template]) => this.isTemplateApplicable(template, context));

      for (const [templateId, template] of phaseTemplates) {
        // Skip if pruning and task is not necessary for this project
        if (options.pruneUnnecessaryTasks && this.shouldPruneTask(template, context)) {
          logger.debug(`Pruning unnecessary task: ${template.title}`);
          continue;
        }

        const wbsItem: WbsItem = {
          id: `WBS-${itemCounter.toString().padStart(3, '0')}`,
          title: template.title,
          description: template.description,
          phase,
          disciplineTags: this.getApplicableDisciplines(template, context),
          aiAssistable: template.aiAssistable,
          aiHint: options.includeAiHints ? template.aiHint : undefined,
          dependencies: template.dependencies || [],
          estimatedHours: template.estimatedHours,
          priority: template.priority,
          templateId,
        };

        wbsItems.push(wbsItem);
        itemCounter++;
      }
    }

    // Sort by phase order and priority
    const phaseOrder: Record<Phase, number> = {
      concept: 1,
      prelim: 2,
      detailed: 3,
      critical: 4,
      final: 5,
    };

    const priorityOrder: Record<string, number> = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
    };

    wbsItems.sort((a, b) => {
      const phaseCompare = phaseOrder[a.phase] - phaseOrder[b.phase];
      if (phaseCompare !== 0) return phaseCompare;
      
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    logger.info(`Generated ${wbsItems.length} WBS items for project`);
    return wbsItems;
  }

  /**
   * Prune WBS items based on project context and AI recommendations
   */
  pruneWbs(wbsItems: WbsItem[], context: ProjectContext): WbsItem[] {
    logger.info('Pruning WBS items based on project context');

    const prunedItems = wbsItems.filter(item => {
      // Keep critical priority items
      if (item.priority === 'critical') {
        return true;
      }

      // Check if item is applicable to project disciplines
      const hasApplicableDiscipline = item.disciplineTags.some(tag => 
        context.disciplines.includes(tag)
      );

      if (!hasApplicableDiscipline) {
        logger.debug(`Pruning item not applicable to disciplines: ${item.title}`);
        return false;
      }

      // Check complexity-based pruning
      if (context.complexity === 'low' && item.priority === 'low') {
        logger.debug(`Pruning low priority item for low complexity project: ${item.title}`);
        return false;
      }

      return true;
    });

    logger.info(`Pruned ${wbsItems.length - prunedItems.length} items, ${prunedItems.length} remaining`);
    return prunedItems;
  }

  /**
   * Update WBS items with AI assistance information
   */
  updateWbsWithAiInfo(wbsItems: WbsItem[], aiRecommendations: Record<string, boolean>): WbsItem[] {
    return wbsItems.map(item => {
      const aiAssistable = aiRecommendations[item.id] ?? item.aiAssistable;
      
      // Apply AI guardrails - never allow AI for critical engineering tasks
      const prohibitedTasks = [
        'design', 'analysis', 'verification', 'validation', 'safety', 'compliance',
        'fea', 'simulation', 'schematic', 'pcb', 'layout', 'review'
      ];

      const isProhibited = prohibitedTasks.some(keyword => 
        item.title.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword)
      );

      if (isProhibited) {
        logger.debug(`AI assistance prohibited for engineering task: ${item.title}`);
        return {
          ...item,
          aiAssistable: false,
          aiHint: undefined,
        };
      }

      return {
        ...item,
        aiAssistable,
      };
    });
  }

  /**
   * Get the golden checklist template for a specific discipline and phase
   */
  getGoldenChecklist(discipline: Discipline, phase: Phase): WbsTemplate[] {
    const templates = Object.values(this.templates)
      .filter(template => 
        template.disciplines.includes(discipline) && 
        template.phase === phase
      );

    logger.debug(`Found ${templates.length} golden checklist items for ${discipline} in ${phase} phase`);
    return templates;
  }

  /**
   * Check if a template is applicable to the project context
   */
  private isTemplateApplicable(template: WbsTemplate, context: ProjectContext): boolean {
    // Check if any of the template's disciplines match project disciplines
    const disciplineMatch = template.disciplines.some(d => context.disciplines.includes(d));
    
    // Check if complexity is appropriate
    const complexityMatch = template.complexity.includes(context.complexity);
    
    return disciplineMatch && complexityMatch;
  }

  /**
   * Determine if a task should be pruned for this project
   */
  private shouldPruneTask(template: WbsTemplate, context: ProjectContext): boolean {
    // Never prune critical tasks
    if (template.priority === 'critical') {
      return false;
    }

    // Prune low priority tasks for simple projects
    if (context.complexity === 'low' && template.priority === 'low') {
      return true;
    }

    // Prune tasks that don't match any project disciplines
    const hasMatchingDiscipline = template.disciplines.some(d => 
      context.disciplines.includes(d)
    );

    return !hasMatchingDiscipline;
  }

  /**
   * Get applicable disciplines for a template based on project context
   */
  private getApplicableDisciplines(template: WbsTemplate, context: ProjectContext): Discipline[] {
    return template.disciplines.filter(d => context.disciplines.includes(d));
  }

  /**
   * Initialize standard WBS templates for hardware projects
   */
  private initializeStandardTemplates(): void {
    this.templates = {
      // Concept Phase
      'concept-requirements-gathering': {
        title: 'Requirements Gathering and Analysis',
        description: 'Collect and analyze stakeholder requirements, define success criteria',
        phase: 'concept',
        disciplines: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
        complexity: ['low', 'medium', 'high'],
        aiAssistable: true,
        aiHint: 'AI can help structure requirements and identify gaps',
        priority: 'critical',
        estimatedHours: 16,
      },
      'concept-feasibility': {
        title: 'Technical Feasibility Study',
        description: 'Assess technical feasibility of proposed solution',
        phase: 'concept',
        disciplines: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
        complexity: ['medium', 'high'],
        aiAssistable: false,
        priority: 'critical',
        estimatedHours: 24,
      },
      'concept-market-research': {
        title: 'Market Research and Competitive Analysis',
        description: 'Research existing solutions and market landscape',
        phase: 'concept',
        disciplines: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
        complexity: ['low', 'medium', 'high'],
        aiAssistable: true,
        aiHint: 'AI can help gather and summarize market data',
        priority: 'high',
        estimatedHours: 12,
      },

      // Preliminary Design Phase
      'prelim-architecture': {
        title: 'System Architecture Definition',
        description: 'Define high-level system architecture and interfaces',
        phase: 'prelim',
        disciplines: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
        complexity: ['medium', 'high'],
        aiAssistable: false,
        priority: 'critical',
        estimatedHours: 32,
        dependencies: ['concept-requirements-gathering'],
      },
      'prelim-component-selection': {
        title: 'Component Selection and Evaluation',
        description: 'Select and evaluate key components and technologies',
        phase: 'prelim',
        disciplines: ['Mechanical', 'Electrical'],
        complexity: ['low', 'medium', 'high'],
        aiAssistable: true,
        aiHint: 'AI can help compare component specifications and availability',
        priority: 'high',
        estimatedHours: 20,
      },
      'prelim-risk-assessment': {
        title: 'Risk Assessment and Mitigation Planning',
        description: 'Identify technical risks and develop mitigation strategies',
        phase: 'prelim',
        disciplines: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
        complexity: ['medium', 'high'],
        aiAssistable: true,
        aiHint: 'AI can help identify common failure modes and risks',
        priority: 'critical',
        estimatedHours: 16,
      },

      // Detailed Design Phase
      'detailed-mechanical-design': {
        title: 'Detailed Mechanical Design',
        description: 'Create detailed mechanical drawings and CAD models',
        phase: 'detailed',
        disciplines: ['Mechanical'],
        complexity: ['low', 'medium', 'high'],
        aiAssistable: false,
        priority: 'critical',
        estimatedHours: 80,
        dependencies: ['prelim-architecture'],
      },
      'detailed-electrical-schematic': {
        title: 'Electrical Schematic Design',
        description: 'Create detailed electrical schematics and circuit design',
        phase: 'detailed',
        disciplines: ['Electrical'],
        complexity: ['low', 'medium', 'high'],
        aiAssistable: false,
        priority: 'critical',
        estimatedHours: 60,
        dependencies: ['prelim-component-selection'],
      },
      'detailed-pcb-layout': {
        title: 'PCB Layout Design',
        description: 'Design PCB layout and routing',
        phase: 'detailed',
        disciplines: ['Electrical'],
        complexity: ['medium', 'high'],
        aiAssistable: false,
        priority: 'critical',
        estimatedHours: 40,
        dependencies: ['detailed-electrical-schematic'],
      },
      'detailed-firmware-architecture': {
        title: 'Firmware Architecture Design',
        description: 'Design firmware architecture and module interfaces',
        phase: 'detailed',
        disciplines: ['Firmware'],
        complexity: ['medium', 'high'],
        aiAssistable: false,
        priority: 'critical',
        estimatedHours: 32,
        dependencies: ['prelim-architecture'],
      },
      'detailed-software-architecture': {
        title: 'Software Architecture Design',
        description: 'Design software architecture and API specifications',
        phase: 'detailed',
        disciplines: ['Software'],
        complexity: ['medium', 'high'],
        aiAssistable: false,
        priority: 'critical',
        estimatedHours: 32,
        dependencies: ['prelim-architecture'],
      },

      // Critical Design Review Phase
      'critical-design-review': {
        title: 'Critical Design Review',
        description: 'Conduct comprehensive design review with stakeholders',
        phase: 'critical',
        disciplines: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
        complexity: ['low', 'medium', 'high'],
        aiAssistable: false,
        priority: 'critical',
        estimatedHours: 16,
        dependencies: ['detailed-mechanical-design', 'detailed-electrical-schematic'],
      },
      'critical-verification-planning': {
        title: 'Verification and Validation Planning',
        description: 'Plan verification and validation test procedures',
        phase: 'critical',
        disciplines: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
        complexity: ['medium', 'high'],
        aiAssistable: true,
        aiHint: 'AI can help structure test plans and identify test cases',
        priority: 'critical',
        estimatedHours: 24,
      },
      'critical-manufacturing-planning': {
        title: 'Manufacturing Process Planning',
        description: 'Plan manufacturing processes and quality controls',
        phase: 'critical',
        disciplines: ['Mechanical', 'Electrical'],
        complexity: ['medium', 'high'],
        aiAssistable: true,
        aiHint: 'AI can help optimize manufacturing sequences',
        priority: 'high',
        estimatedHours: 20,
      },

      // Final Phase
      'final-prototype-build': {
        title: 'Prototype Build and Assembly',
        description: 'Build and assemble prototype units',
        phase: 'final',
        disciplines: ['Mechanical', 'Electrical'],
        complexity: ['low', 'medium', 'high'],
        aiAssistable: false,
        priority: 'critical',
        estimatedHours: 40,
        dependencies: ['critical-design-review'],
      },
      'final-firmware-implementation': {
        title: 'Firmware Implementation',
        description: 'Implement and test firmware modules',
        phase: 'final',
        disciplines: ['Firmware'],
        complexity: ['medium', 'high'],
        aiAssistable: true,
        aiHint: 'AI can assist with code generation for standard protocols',
        priority: 'critical',
        estimatedHours: 80,
        dependencies: ['detailed-firmware-architecture'],
      },
      'final-software-implementation': {
        title: 'Software Implementation',
        description: 'Implement and test software applications',
        phase: 'final',
        disciplines: ['Software'],
        complexity: ['medium', 'high'],
        aiAssistable: true,
        aiHint: 'AI can assist with UI/UX implementation and testing',
        priority: 'critical',
        estimatedHours: 80,
        dependencies: ['detailed-software-architecture'],
      },
      'final-testing-validation': {
        title: 'System Testing and Validation',
        description: 'Execute comprehensive system testing',
        phase: 'final',
        disciplines: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
        complexity: ['low', 'medium', 'high'],
        aiAssistable: false,
        priority: 'critical',
        estimatedHours: 60,
        dependencies: ['final-prototype-build', 'final-firmware-implementation'],
      },
      'final-documentation': {
        title: 'Technical Documentation',
        description: 'Create user manuals, technical documentation, and maintenance guides',
        phase: 'final',
        disciplines: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
        complexity: ['low', 'medium', 'high'],
        aiAssistable: true,
        aiHint: 'AI can help generate and format technical documentation',
        priority: 'high',
        estimatedHours: 32,
      },
    };

    logger.debug(`Initialized ${Object.keys(this.templates).length} standard WBS templates`);
  }
}

// Singleton instance
let wbsGeneratorInstance: WbsGeneratorService | null = null;

/**
 * Get or create the WBS generator service singleton
 */
export function getWbsGeneratorService(): WbsGeneratorService {
  if (!wbsGeneratorInstance) {
    wbsGeneratorInstance = new WbsGeneratorService();
  }
  return wbsGeneratorInstance;
}

/**
 * Reset the WBS generator service singleton (useful for testing)
 */
export function resetWbsGeneratorService(): void {
  wbsGeneratorInstance = null;
}
