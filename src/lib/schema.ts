/**
 * Zod schemas for SpecForge CLI
 * Mirrors entities and provides additional validation schemas
 */

import { z } from 'zod';
import {
  ProjectSchema,
  PhaseSchema,
  RequirementsPackageSchema,
  RequirementSchema,
  WbsItemSchema,
  BaselineSchema,
  ChangeLogSchema,
  GitHubLabelSchema,
  GitHubMilestoneSchema,
  GitHubIssueSchema,
  DisciplineEnum,
  ComplexityEnum,
  PhaseEnum,
  VerificationMethodEnum,
  ChangeTypeEnum,
} from '../models/entities.js';

// Re-export entity schemas
export {
  ProjectSchema,
  PhaseSchema,
  RequirementsPackageSchema,
  RequirementSchema,
  WbsItemSchema,
  BaselineSchema,
  ChangeLogSchema,
  GitHubLabelSchema,
  GitHubMilestoneSchema,
  GitHubIssueSchema,
  DisciplineEnum,
  ComplexityEnum,
  PhaseEnum,
  VerificationMethodEnum,
  ChangeTypeEnum,
};

// CLI command schemas
export const InitCommandSchema = z.object({
  org: z.string().min(1, 'Organization is required'),
  repo: z.string().min(1, 'Repository is required'),
  disciplines: z.array(DisciplineEnum).min(1, 'At least one discipline is required'),
  complexity: ComplexityEnum,
  aiProvider: z.string().optional(),
  dryRun: z.boolean().default(false),
  json: z.boolean().default(false),
}).strict();

export const RefactorCommandSchema = z.object({
  org: z.string().min(1, 'Organization is required'),
  repo: z.string().min(1, 'Repository is required'),
  reconcile: z.boolean().default(false),
  prune: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  json: z.boolean().default(false),
}).strict();

export const PlanCommandSchema = z.object({
  org: z.string().optional(),
  repo: z.string().optional(),
  disciplines: z.array(DisciplineEnum).optional(),
  complexity: ComplexityEnum.optional(),
  dryRun: z.boolean().default(false),
  json: z.boolean().default(false),
}).strict();

export const BaselineCommandSchema = z.object({
  org: z.string().min(1, 'Organization is required'),
  repo: z.string().min(1, 'Repository is required'),
  tag: z.string().min(1, 'Tag is required'),
  approve: z.boolean().default(false),
  approver: z.string().optional(),
  dryRun: z.boolean().default(false),
  json: z.boolean().default(false),
}).strict();

export const LabelsCommandSchema = z.object({
  org: z.string().min(1, 'Organization is required'),
  repo: z.string().min(1, 'Repository is required'),
  dryRun: z.boolean().default(false),
  json: z.boolean().default(false),
}).strict();

// Configuration schemas
export const GitHubConfigSchema = z.object({
  token: z.string().min(1, 'GitHub token is required'),
  org: z.string().min(1, 'Organization is required'),
  repo: z.string().min(1, 'Repository is required'),
});

export const AIConfigSchema = z.object({
  provider: z.enum(['openai', 'azure-openai', 'anthropic', 'bedrock', 'local']),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  endpoint: z.string().url().optional(),
});

export const BehaviorConfigSchema = z.object({
  dryRun: z.boolean().default(false),
  verbose: z.boolean().default(false),
  json: z.boolean().default(false),
  autoApprove: z.boolean().default(false),
});

export const PathsConfigSchema = z.object({
  requirements: z.string().default('requirements/'),
  baselines: z.string().default('baselines/'),
  specs: z.string().default('specs/'),
});

export const PerformanceConfigSchema = z.object({
  maxConcurrentRequests: z.number().min(1).max(20).default(5),
  retryAttempts: z.number().min(0).max(10).default(3),
  timeoutMs: z.number().min(1000).max(60000).default(30000),
  rateLimitBuffer: z.number().min(0).max(1000).default(100),
});

// API response schemas
export const GitHubAPIErrorSchema = z.object({
  message: z.string(),
  documentation_url: z.string().optional(),
  errors: z.array(z.object({
    resource: z.string().optional(),
    field: z.string().optional(),
    code: z.string(),
    message: z.string().optional(),
  })).optional(),
});

export const GitHubRateLimitSchema = z.object({
  limit: z.number(),
  remaining: z.number(),
  reset: z.number(),
  used: z.number(),
});

export const GitHubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: z.object({
    login: z.string(),
    id: z.number(),
  }),
  private: z.boolean(),
  permissions: z.object({
    admin: z.boolean(),
    push: z.boolean(),
    pull: z.boolean(),
  }).optional(),
});

// Operation result schemas
export const OperationResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});

export const BatchOperationResultSchema = z.object({
  totalOperations: z.number(),
  successful: z.number(),
  failed: z.number(),
  skipped: z.number(),
  results: z.array(OperationResultSchema),
  summary: z.string(),
});

// Change tracking schemas
export const ChangeRecordSchema = z.object({
  id: z.string(),
  type: ChangeTypeEnum,
  resource: z.enum(['issue', 'label', 'milestone', 'project', 'requirement']),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  reason: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const ChangeSummarySchema = z.object({
  changes: z.array(ChangeRecordSchema),
  statistics: z.object({
    added: z.number(),
    modified: z.number(),
    removed: z.number(),
    preserved: z.number(),
  }),
  hasConflicts: z.boolean(),
  requiresApproval: z.boolean(),
});

// Validation schemas
export const RequirementValidationSchema = RequirementSchema.extend({
  linkedIssues: z.array(z.string()).optional(),
  parentRequirement: z.string().optional(),
  childRequirements: z.array(z.string()).optional(),
  verificationStatus: z.enum(['pending', 'in-progress', 'passed', 'failed']).default('pending'),
});

export const WbsValidationSchema = WbsItemSchema.extend({
  estimatedHours: z.number().min(0).optional(),
  actualHours: z.number().min(0).optional(),
  status: z.enum(['not-started', 'in-progress', 'completed', 'blocked']).default('not-started'),
  assignees: z.array(z.string()).optional(),
  dueDate: z.string().datetime().optional(),
});

// File format schemas
export const MarkdownFrontMatterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  date: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const RequirementsFileSchema = z.object({
  frontMatter: MarkdownFrontMatterSchema,
  sections: z.record(z.string(), z.string()),
  requirements: z.array(RequirementValidationSchema),
});

export const WbsFileSchema = z.object({
  frontMatter: MarkdownFrontMatterSchema,
  phases: z.record(PhaseEnum, z.array(WbsValidationSchema)),
});

// Import/Export schemas
export const ExportDataSchema = z.object({
  version: z.string(),
  timestamp: z.string().datetime(),
  project: ProjectSchema,
  requirements: z.array(RequirementValidationSchema).optional(),
  wbsItems: z.array(WbsValidationSchema).optional(),
  baselines: z.array(BaselineSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ImportOptionsSchema = z.object({
  merge: z.boolean().default(false),
  overwrite: z.boolean().default(false),
  validate: z.boolean().default(true),
  dryRun: z.boolean().default(false),
});

// Webhook schemas
export const GitHubWebhookSchema = z.object({
  action: z.string(),
  repository: GitHubRepositorySchema,
  sender: z.object({
    login: z.string(),
    id: z.number(),
  }),
  issue: GitHubIssueSchema.optional(),
  label: GitHubLabelSchema.optional(),
  milestone: GitHubMilestoneSchema.optional(),
});

// Metrics and telemetry schemas
export const MetricsSchema = z.object({
  command: z.string(),
  duration: z.number(),
  success: z.boolean(),
  resourcesCreated: z.number().optional(),
  resourcesModified: z.number().optional(),
  resourcesDeleted: z.number().optional(),
  apiCallsCount: z.number().optional(),
  rateLimitHits: z.number().optional(),
  errors: z.array(z.string()).optional(),
});

export const TelemetryEventSchema = z.object({
  event: z.string(),
  timestamp: z.string().datetime(),
  userId: z.string().optional(),
  sessionId: z.string(),
  properties: z.record(z.string(), z.unknown()).optional(),
  metrics: MetricsSchema.optional(),
});

// Type exports
export type InitCommand = z.infer<typeof InitCommandSchema>;
export type RefactorCommand = z.infer<typeof RefactorCommandSchema>;
export type PlanCommand = z.infer<typeof PlanCommandSchema>;
export type BaselineCommand = z.infer<typeof BaselineCommandSchema>;
export type LabelsCommand = z.infer<typeof LabelsCommandSchema>;

export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;
export type AIConfig = z.infer<typeof AIConfigSchema>;
export type BehaviorConfig = z.infer<typeof BehaviorConfigSchema>;
export type PathsConfig = z.infer<typeof PathsConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;

export type OperationResult = z.infer<typeof OperationResultSchema>;
export type BatchOperationResult = z.infer<typeof BatchOperationResultSchema>;
export type ChangeRecord = z.infer<typeof ChangeRecordSchema>;
export type ChangeSummary = z.infer<typeof ChangeSummarySchema>;

export type RequirementValidation = z.infer<typeof RequirementValidationSchema>;
export type WbsValidation = z.infer<typeof WbsValidationSchema>;
export type RequirementsFile = z.infer<typeof RequirementsFileSchema>;
export type WbsFile = z.infer<typeof WbsFileSchema>;

export type ExportData = z.infer<typeof ExportDataSchema>;
export type ImportOptions = z.infer<typeof ImportOptionsSchema>;
export type GitHubWebhook = z.infer<typeof GitHubWebhookSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

// Validation helper functions
export function validateInitCommand(data: unknown): InitCommand {
  return InitCommandSchema.parse(data);
}

export function validateRefactorCommand(data: unknown): RefactorCommand {
  return RefactorCommandSchema.parse(data);
}

export function validatePlanCommand(data: unknown): PlanCommand {
  return PlanCommandSchema.parse(data);
}

export function validateBaselineCommand(data: unknown): BaselineCommand {
  return BaselineCommandSchema.parse(data);
}

export function validateLabelsCommand(data: unknown): LabelsCommand {
  return LabelsCommandSchema.parse(data);
}

export function validateGitHubConfig(data: unknown): GitHubConfig {
  return GitHubConfigSchema.parse(data);
}

export function validateAIConfig(data: unknown): AIConfig {
  return AIConfigSchema.parse(data);
}

export function validateOperationResult(data: unknown): OperationResult {
  return OperationResultSchema.parse(data);
}

export function validateChangeSummary(data: unknown): ChangeSummary {
  return ChangeSummarySchema.parse(data);
}

// Schema registry for dynamic validation
export const SCHEMA_REGISTRY = {
  // Commands
  'init-command': InitCommandSchema,
  'refactor-command': RefactorCommandSchema,
  'plan-command': PlanCommandSchema,
  'baseline-command': BaselineCommandSchema,
  'labels-command': LabelsCommandSchema,
  
  // Entities
  'project': ProjectSchema,
  'requirement': RequirementSchema,
  'wbs-item': WbsItemSchema,
  'baseline': BaselineSchema,
  'change-log': ChangeLogSchema,
  
  // Configuration
  'github-config': GitHubConfigSchema,
  'ai-config': AIConfigSchema,
  'behavior-config': BehaviorConfigSchema,
  
  // Results
  'operation-result': OperationResultSchema,
  'batch-result': BatchOperationResultSchema,
  'change-summary': ChangeSummarySchema,
  
  // Files
  'requirements-file': RequirementsFileSchema,
  'wbs-file': WbsFileSchema,
  'export-data': ExportDataSchema,
};

export function getSchema(name: string): z.ZodSchema | undefined {
  return SCHEMA_REGISTRY[name as keyof typeof SCHEMA_REGISTRY];
}

export function validateWithSchema(schemaName: string, data: unknown): unknown {
  const schema = getSchema(schemaName);
  if (!schema) {
    throw new Error(`Unknown schema: ${schemaName}`);
  }
  return schema.parse(data);
}
