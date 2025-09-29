/**
 * AI guardrails and business rules for SpecForge CLI
 * Enforces policies around AI assistance and task classification
 */

import { WbsItem, Discipline, Phase } from '../models/entities.js';
import { AIPolicyViolationError, BusinessLogicError } from './errors.js';

// AI Policy Rules
export interface AIPolicyRule {
  name: string;
  description: string;
  check: (task: TaskContext) => boolean;
  reason: string;
  severity: 'error' | 'warning' | 'info';
}

export interface TaskContext {
  title: string;
  description?: string;
  phase: Phase;
  disciplines: Discipline[];
  category?: TaskCategory;
  keywords?: string[];
}

// Task categories for AI policy enforcement
export enum TaskCategory {
  DOCUMENTATION = 'documentation',
  DESIGN = 'design',
  ANALYSIS = 'analysis',
  VERIFICATION = 'verification',
  TESTING = 'testing',
  MANUFACTURING = 'manufacturing',
  COMPLIANCE = 'compliance',
  PROJECT_MANAGEMENT = 'project_management',
  REQUIREMENTS = 'requirements',
}

// Prohibited patterns for AI assistance
const PROHIBITED_PATTERNS = [
  // Design tasks
  /design.*circuit/i,
  /circuit.*design/i,
  /pcb.*layout/i,
  /pcb.*design/i,
  /schematic/i,
  /component.*selection/i,
  /topology.*design/i,
  
  // Mechanical design
  /cad.*model/i,
  /mechanical.*design/i,
  /structural.*design/i,
  /material.*selection/i,
  /dimension/i,
  /tolerance/i,
  
  // Analysis tasks
  /fea/i,
  /finite.*element/i,
  /stress.*analysis/i,
  /thermal.*analysis/i,
  /fluid.*dynamics/i,
  /simulation/i,
  /calculation/i,
  
  // Safety and compliance
  /safety.*verification/i,
  /safety.*validation/i,
  /compliance.*verification/i,
  /regulatory.*compliance/i,
  /certification/i,
  /standards.*compliance/i,
  
  // Engineering judgment
  /engineering.*judgment/i,
  /design.*review/i,
  /technical.*review/i,
  /approve/i,
  /sign.*off/i,
  /validate/i,
  /verify/i,
];

// Allowed patterns for AI assistance
const ALLOWED_PATTERNS = [
  // Documentation
  /documentation/i,
  /template/i,
  /report.*generation/i,
  /checklist/i,
  
  // Requirements drafting (with human review)
  /requirement.*draft/i,
  /requirement.*text/i,
  /specification.*draft/i,
  
  // Testing support
  /test.*case/i,
  /test.*procedure/i,
  /test.*plan/i,
  
  // Process automation
  /automation/i,
  /script/i,
  /workflow/i,
  
  // Data analysis (non-engineering)
  /data.*analysis/i,
  /visualization/i,
  /dashboard/i,
];

// Core AI policy rules
export const AI_POLICY_RULES: AIPolicyRule[] = [
  {
    name: 'no-circuit-design',
    description: 'AI cannot perform circuit design or electrical engineering calculations',
    check: (task) => {
      const text = `${task.title} ${task.description || ''}`.toLowerCase();
      return /circuit|electrical.*design|pcb|schematic|power.*supply.*design/.test(text);
    },
    reason: 'Circuit design requires human engineering expertise and safety considerations',
    severity: 'error',
  },
  
  {
    name: 'no-mechanical-design',
    description: 'AI cannot perform mechanical design or structural analysis',
    check: (task) => {
      const text = `${task.title} ${task.description || ''}`.toLowerCase();
      return /mechanical.*design|cad|fea|stress.*analysis|structural/.test(text);
    },
    reason: 'Mechanical design requires human engineering expertise and safety validation',
    severity: 'error',
  },
  
  {
    name: 'no-safety-verification',
    description: 'AI cannot perform safety verification or validation tasks',
    check: (task) => {
      const text = `${task.title} ${task.description || ''}`.toLowerCase();
      return /safety.*verification|safety.*validation|hazard.*analysis/.test(text);
    },
    reason: 'Safety verification requires human expertise and regulatory compliance',
    severity: 'error',
  },
  
  {
    name: 'no-compliance-verification',
    description: 'AI cannot verify regulatory compliance or standards conformance',
    check: (task) => {
      const text = `${task.title} ${task.description || ''}`.toLowerCase();
      return /compliance.*verification|regulatory.*compliance|standards.*conformance/.test(text);
    },
    reason: 'Compliance verification requires human expertise and legal responsibility',
    severity: 'error',
  },
  
  {
    name: 'no-engineering-approval',
    description: 'AI cannot provide engineering approvals or sign-offs',
    check: (task) => {
      const text = `${task.title} ${task.description || ''}`.toLowerCase();
      return /approve|sign.*off|validate|authorize|certify/.test(text) && 
             /engineering|design|technical/.test(text);
    },
    reason: 'Engineering approvals require human responsibility and professional liability',
    severity: 'error',
  },
  
  {
    name: 'documentation-allowed',
    description: 'AI can assist with documentation and template generation',
    check: (task) => {
      const text = `${task.title} ${task.description || ''}`.toLowerCase();
      return /documentation|template|report.*generation|checklist|procedure/.test(text) &&
             !/design|analysis|verification|approval/.test(text);
    },
    reason: 'Documentation tasks are suitable for AI assistance with human oversight',
    severity: 'info',
  },
];

// Discipline-specific rules
export const DISCIPLINE_RULES: Record<Discipline, AIPolicyRule[]> = {
  Mechanical: [
    {
      name: 'no-mechanical-calculations',
      description: 'AI cannot perform mechanical engineering calculations',
      check: (task) => /calculation|analysis|simulation|fea/.test(task.title.toLowerCase()),
      reason: 'Mechanical calculations require engineering expertise and safety validation',
      severity: 'error',
    },
    {
      name: 'no-material-selection',
      description: 'AI cannot select materials for mechanical components',
      check: (task) => /material.*selection|material.*choice/.test(task.title.toLowerCase()),
      reason: 'Material selection affects safety, performance, and regulatory compliance',
      severity: 'error',
    },
  ],
  
  Electrical: [
    {
      name: 'no-electrical-design',
      description: 'AI cannot perform electrical design or analysis',
      check: (task) => /electrical.*design|circuit|power.*analysis/.test(task.title.toLowerCase()),
      reason: 'Electrical design requires safety considerations and regulatory compliance',
      severity: 'error',
    },
    {
      name: 'no-emc-analysis',
      description: 'AI cannot perform EMC analysis or compliance verification',
      check: (task) => /emc|electromagnetic.*compatibility|emi/.test(task.title.toLowerCase()),
      reason: 'EMC analysis requires specialized expertise and regulatory knowledge',
      severity: 'error',
    },
  ],
  
  Firmware: [
    {
      name: 'no-safety-critical-code',
      description: 'AI cannot write safety-critical firmware code',
      check: (task) => {
        const text = task.title.toLowerCase();
        return /safety.*critical|real.*time|interrupt.*handler/.test(text);
      },
      reason: 'Safety-critical firmware requires human expertise and validation',
      severity: 'error',
    },
    {
      name: 'limited-code-generation',
      description: 'AI code generation requires human review for firmware',
      check: (task) => /code.*generation|implementation/.test(task.title.toLowerCase()),
      reason: 'Firmware code affects hardware operation and requires careful review',
      severity: 'warning',
    },
  ],
  
  Software: [
    {
      name: 'no-security-implementation',
      description: 'AI cannot implement security-critical software features',
      check: (task) => /security.*implementation|encryption|authentication/.test(task.title.toLowerCase()),
      reason: 'Security implementations require specialized expertise and validation',
      severity: 'error',
    },
    {
      name: 'ui-generation-allowed',
      description: 'AI can assist with UI/UX design and implementation',
      check: (task) => /ui|user.*interface|frontend|mockup/.test(task.title.toLowerCase()),
      reason: 'UI/UX tasks are suitable for AI assistance with human oversight',
      severity: 'info',
    },
  ],
};

// Phase-specific rules
export const PHASE_RULES: Record<Phase, AIPolicyRule[]> = {
  concept: [
    {
      name: 'concept-documentation-allowed',
      description: 'AI can help with concept documentation and templates',
      check: (task) => /documentation|template|outline/.test(task.title.toLowerCase()),
      reason: 'Concept phase documentation is suitable for AI assistance',
      severity: 'info',
    },
  ],
  
  prelim: [
    {
      name: 'no-preliminary-calculations',
      description: 'AI cannot perform preliminary engineering calculations',
      check: (task) => /calculation|sizing|estimation/.test(task.title.toLowerCase()),
      reason: 'Preliminary calculations affect design decisions and safety',
      severity: 'error',
    },
  ],
  
  detailed: [
    {
      name: 'no-detailed-design',
      description: 'AI cannot perform detailed design work',
      check: (task) => /detailed.*design|final.*design/.test(task.title.toLowerCase()),
      reason: 'Detailed design requires human engineering expertise',
      severity: 'error',
    },
  ],
  
  critical: [
    {
      name: 'no-critical-verification',
      description: 'AI cannot perform critical design verification',
      check: (task) => /verification|validation|review/.test(task.title.toLowerCase()),
      reason: 'Critical phase verification requires human expertise and responsibility',
      severity: 'error',
    },
  ],
  
  final: [
    {
      name: 'no-final-approvals',
      description: 'AI cannot provide final approvals or sign-offs',
      check: (task) => /approval|sign.*off|release/.test(task.title.toLowerCase()),
      reason: 'Final approvals require human responsibility and professional liability',
      severity: 'error',
    },
  ],
};

// Rule evaluation engine
export class AIRuleEngine {
  private rules: AIPolicyRule[] = [];
  
  constructor() {
    this.rules = [...AI_POLICY_RULES];
  }
  
  addRule(rule: AIPolicyRule): void {
    this.rules.push(rule);
  }
  
  addDisciplineRules(discipline: Discipline): void {
    const disciplineRules = DISCIPLINE_RULES[discipline] || [];
    this.rules.push(...disciplineRules);
  }
  
  addPhaseRules(phase: Phase): void {
    const phaseRules = PHASE_RULES[phase] || [];
    this.rules.push(...phaseRules);
  }
  
  evaluateTask(task: TaskContext): AIRuleEvaluation {
    const violations: AIPolicyRule[] = [];
    const warnings: AIPolicyRule[] = [];
    const allowances: AIPolicyRule[] = [];
    
    for (const rule of this.rules) {
      if (rule.check(task)) {
        switch (rule.severity) {
          case 'error':
            violations.push(rule);
            break;
          case 'warning':
            warnings.push(rule);
            break;
          case 'info':
            allowances.push(rule);
            break;
        }
      }
    }
    
    return {
      isAIAssistable: violations.length === 0,
      violations,
      warnings,
      allowances,
      recommendation: this.generateRecommendation(violations, warnings, allowances),
    };
  }
  
  private generateRecommendation(
    violations: AIPolicyRule[],
    warnings: AIPolicyRule[],
    allowances: AIPolicyRule[]
  ): string {
    if (violations.length > 0) {
      return `AI assistance not allowed: ${violations[0].reason}`;
    }
    
    if (warnings.length > 0) {
      return `AI assistance allowed with caution: ${warnings[0].reason}`;
    }
    
    if (allowances.length > 0) {
      return `AI assistance recommended: ${allowances[0].reason}`;
    }
    
    return 'AI assistance policy unclear - default to human-only';
  }
}

export interface AIRuleEvaluation {
  isAIAssistable: boolean;
  violations: AIPolicyRule[];
  warnings: AIPolicyRule[];
  allowances: AIPolicyRule[];
  recommendation: string;
}

// Utility functions
export function isTaskAIAssistable(task: TaskContext): boolean {
  const engine = new AIRuleEngine();
  task.disciplines.forEach(discipline => engine.addDisciplineRules(discipline));
  engine.addPhaseRules(task.phase);
  
  const evaluation = engine.evaluateTask(task);
  return evaluation.isAIAssistable;
}

export function generateAIHint(task: TaskContext): string | null {
  if (!isTaskAIAssistable(task)) {
    return null;
  }
  
  // Generate context-specific hints
  const hints: string[] = [];
  
  if (task.category === TaskCategory.DOCUMENTATION) {
    hints.push('Generate comprehensive documentation templates based on industry standards');
  }
  
  if (task.category === TaskCategory.TESTING) {
    hints.push('Create detailed test procedures with clear pass/fail criteria');
  }
  
  if (task.category === TaskCategory.REQUIREMENTS) {
    hints.push('Draft requirement text based on specifications - requires human review and approval');
  }
  
  if (task.phase === 'concept') {
    hints.push('Focus on high-level structure and organization for concept phase deliverables');
  }
  
  // Add discipline-specific hints
  if (task.disciplines.includes('Software') && task.category === TaskCategory.DOCUMENTATION) {
    hints.push('Include code documentation standards and API documentation templates');
  }
  
  if (task.disciplines.includes('Mechanical') && task.category === TaskCategory.TESTING) {
    hints.push('Include physical test procedures and measurement protocols');
  }
  
  return hints.length > 0 ? hints.join('. ') : 'Assist with task organization and documentation structure';
}

export function validateWbsItemAIPolicy(wbsItem: WbsItem): void {
  const taskContext: TaskContext = {
    title: wbsItem.title,
    phase: wbsItem.phase,
    disciplines: wbsItem.disciplineTags,
  };
  
  const engine = new AIRuleEngine();
  wbsItem.disciplineTags.forEach(discipline => engine.addDisciplineRules(discipline));
  engine.addPhaseRules(wbsItem.phase);
  
  const evaluation = engine.evaluateTask(taskContext);
  
  if (wbsItem.aiAssistable && !evaluation.isAIAssistable) {
    throw new AIPolicyViolationError(
      wbsItem.title,
      evaluation.violations[0]?.reason || 'AI assistance not allowed for this task type'
    );
  }
  
  if (!wbsItem.aiAssistable && evaluation.isAIAssistable && evaluation.allowances.length > 0) {
    // This is just a warning - task could be AI-assistable but is marked as not
    console.warn(`Task '${wbsItem.title}' could potentially be AI-assistable: ${evaluation.recommendation}`);
  }
}

// Task categorization
export function categorizeTask(title: string, description?: string): TaskCategory {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  if (/documentation|template|report|manual/.test(text)) {
    return TaskCategory.DOCUMENTATION;
  }
  
  if (/design|create|develop|implement/.test(text)) {
    return TaskCategory.DESIGN;
  }
  
  if (/analysis|calculate|simulate|model/.test(text)) {
    return TaskCategory.ANALYSIS;
  }
  
  if (/verify|validate|check|review/.test(text)) {
    return TaskCategory.VERIFICATION;
  }
  
  if (/test|procedure|protocol/.test(text)) {
    return TaskCategory.TESTING;
  }
  
  if (/manufacture|production|assembly/.test(text)) {
    return TaskCategory.MANUFACTURING;
  }
  
  if (/compliance|standard|regulation/.test(text)) {
    return TaskCategory.COMPLIANCE;
  }
  
  if (/requirement|specification/.test(text)) {
    return TaskCategory.REQUIREMENTS;
  }
  
  return TaskCategory.PROJECT_MANAGEMENT;
}

// Business rules for phase gates
export function validatePhaseGateCompletion(
  phase: Phase,
  completedCriteria: string[],
  requiredCriteria: string[]
): void {
  const missingCriteria = requiredCriteria.filter(
    criterion => !completedCriteria.includes(criterion)
  );
  
  if (missingCriteria.length > 0) {
    throw new BusinessLogicError(
      `Phase gate ${phase} cannot be passed. Missing criteria: ${missingCriteria.join(', ')}`
    );
  }
}

// Export default rule engine instance
export const defaultAIRuleEngine = new AIRuleEngine();
