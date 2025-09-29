import { z } from 'zod';

// Enums for type safety
export const DisciplineEnum = z.enum(['Mechanical', 'Electrical', 'Firmware', 'Software']);
export const ComplexityEnum = z.enum(['low', 'medium', 'high']);
export const PhaseEnum = z.enum(['concept', 'prelim', 'detailed', 'critical', 'final']);
export const VerificationMethodEnum = z.enum(['Inspection', 'Test', 'Analysis', 'Demonstration']);
export const ChangeTypeEnum = z.enum(['added', 'changed', 'removed']);

// Type exports for use in other modules
export type Discipline = z.infer<typeof DisciplineEnum>;
export type Complexity = z.infer<typeof ComplexityEnum>;
export type Phase = z.infer<typeof PhaseEnum>;
export type VerificationMethod = z.infer<typeof VerificationMethodEnum>;
export type ChangeType = z.infer<typeof ChangeTypeEnum>;

// Project entity
export const ProjectSchema = z.object({
  id: z.string().describe('Project slug/identifier'),
  org: z.string().describe('GitHub organization'),
  repo: z.string().describe('GitHub repository'),
  disciplines: z.array(DisciplineEnum).min(1).describe('Project disciplines'),
  complexity: ComplexityEnum.describe('Project complexity level'),
  constitution: z.string().optional().describe('Path to constitution document'),
});

export type Project = z.infer<typeof ProjectSchema>;

// Phase entity
export const PhaseSchema = z.object({
  key: PhaseEnum.describe('Phase identifier'),
  gateCriteria: z.array(z.string()).describe('Gate criteria for phase completion'),
  milestoneId: z.number().optional().describe('GitHub milestone ID'),
});

export type PhaseEntity = z.infer<typeof PhaseSchema>;

// Requirements Section entity
export const RequirementsSectionSchema = z.object({
  title: z.string().describe('Section title'),
  requirements: z.array(z.lazy(() => RequirementSchema)).describe('Requirements in this section'),
  description: z.string().optional().describe('Section description'),
  order: z.number().describe('Section order'),
});

export type RequirementsSection = z.infer<typeof RequirementsSectionSchema>;

// Requirements Package entity
export const RequirementsPackageSchema = z.object({
  path: z.string().describe('Path to requirements package'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).describe('Semantic version'),
  baselineTag: z.string().optional().describe('Git tag for baseline'),
  sections: z.record(z.string(), RequirementsSectionSchema).describe('Requirements sections'),
  generatedAt: z.string().optional().describe('Generation timestamp'),
  contentHash: z.string().optional().describe('Content hash for integrity'),
});

export type RequirementsPackage = z.infer<typeof RequirementsPackageSchema>;

// Requirement entity
export const RequirementSchema = z.object({
  id: z.string().describe('Requirement identifier (e.g., FR-001)'),
  section: z.string().describe('Requirements section'),
  text: z.string().describe('Requirement text'),
  acceptanceCriteria: z.array(z.string()).optional().describe('Acceptance criteria'),
  verificationMethod: VerificationMethodEnum.optional().describe('Verification method'),
  rationale: z.string().optional().describe('Requirement rationale'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('Requirement priority'),
});

export type Requirement = z.infer<typeof RequirementSchema>;

// WBS Item entity
export const WbsItemSchema = z.object({
  id: z.string().describe('WBS item identifier (issue slug)'),
  title: z.string().describe('WBS item title'),
  description: z.string().optional().describe('WBS item description'),
  phase: PhaseEnum.describe('Project phase'),
  disciplineTags: z.array(DisciplineEnum).describe('Applicable disciplines'),
  aiAssistable: z.boolean().describe('Whether AI assistance is allowed'),
  aiHint: z.string().optional().describe('AI assistance hint'),
  dependencies: z.array(z.string()).describe('Dependent WBS item IDs'),
  estimatedHours: z.number().optional().describe('Estimated hours for completion'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).describe('Task priority'),
  templateId: z.string().optional().describe('Template ID used to generate this item'),
});

export type WbsItem = z.infer<typeof WbsItemSchema>;

// Baseline entity
export const BaselineSchema = z.object({
  tag: z.string().describe('Git tag for baseline'),
  date: z.string().describe('Baseline date (ISO string)'),
  approver: z.string().describe('Baseline approver'),
  changeLogRef: z.string().optional().describe('Path to changelog file'),
  packageVersion: z.string().optional().describe('Package version at baseline'),
  contentHash: z.string().optional().describe('Content hash at baseline'),
});

export type Baseline = z.infer<typeof BaselineSchema>;

// Change Log entry
export const ChangeLogEntrySchema = z.object({
  id: z.string().describe('Change entry ID'),
  type: ChangeTypeEnum.describe('Type of change'),
  summary: z.string().describe('Change summary'),
  details: z.string().optional().describe('Change details'),
});

export type ChangeLogEntry = z.infer<typeof ChangeLogEntrySchema>;

// Change Log entity
export const ChangeLogSchema = z.object({
  path: z.string().describe('Path to changelog file'),
  fromBaseline: z.string().optional().describe('Previous baseline tag'),
  toVersion: z.string().optional().describe('Current version'),
  generatedAt: z.string().optional().describe('Generation timestamp'),
  entries: z.array(ChangeLogEntrySchema).describe('Change log entries'),
});

export type ChangeLog = z.infer<typeof ChangeLogSchema>;

// Additional types for GitHub integration
export const GitHubLabelSchema = z.object({
  name: z.string(),
  color: z.string(),
  description: z.string().optional(),
});

export type GitHubLabel = z.infer<typeof GitHubLabelSchema>;

export const GitHubMilestoneSchema = z.object({
  id: z.number().optional(),
  title: z.string(),
  description: z.string().optional(),
  state: z.enum(['open', 'closed']).default('open'),
  due_on: z.string().optional(),
});

export type GitHubMilestone = z.infer<typeof GitHubMilestoneSchema>;

export const GitHubIssueSchema = z.object({
  id: z.number().optional(),
  number: z.number().optional(),
  title: z.string(),
  body: z.string().optional(),
  labels: z.array(z.string()),
  assignees: z.array(z.string()).optional(),
  milestone: z.number().optional(),
  state: z.enum(['open', 'closed']).default('open'),
});

export type GitHubIssue = z.infer<typeof GitHubIssueSchema>;

// Validation helper functions
export function validateProject(data: unknown): Project {
  return ProjectSchema.parse(data);
}

export function validateRequirement(data: unknown): Requirement {
  return RequirementSchema.parse(data);
}

export function validateWbsItem(data: unknown): WbsItem {
  return WbsItemSchema.parse(data);
}

export function validateRequirementsPackage(data: unknown): RequirementsPackage {
  return RequirementsPackageSchema.parse(data);
}

export function validateBaseline(data: unknown): Baseline {
  return BaselineSchema.parse(data);
}

export function validateChangeLog(data: unknown): ChangeLog {
  return ChangeLogSchema.parse(data);
}

// Default phase definitions
export const DEFAULT_PHASES: PhaseEntity[] = [
  {
    key: 'concept',
    gateCriteria: [
      'Requirements analysis complete',
      'Concept design approved',
      'Feasibility study complete',
      'Risk assessment complete',
    ],
  },
  {
    key: 'prelim',
    gateCriteria: [
      'System architecture defined',
      'Component selection complete',
      'Preliminary design review passed',
      'Risk mitigation plans approved',
    ],
  },
  {
    key: 'detailed',
    gateCriteria: [
      'Detailed design complete',
      'Simulation and analysis complete',
      'Prototype planning approved',
      'Manufacturing readiness assessed',
    ],
  },
  {
    key: 'critical',
    gateCriteria: [
      'Design verification complete',
      'Critical design review passed',
      'Test planning approved',
      'Manufacturing process validated',
    ],
  },
  {
    key: 'final',
    gateCriteria: [
      'Production documentation complete',
      'Quality assurance plan approved',
      'Launch readiness review passed',
      'Final acceptance criteria met',
    ],
  },
];

// Default label definitions for GitHub integration
export const DEFAULT_LABELS: GitHubLabel[] = [
  // Phase labels
  { name: 'phase:concept', color: 'e1f5fe', description: 'Concept design phase' },
  { name: 'phase:preliminary', color: 'b3e5fc', description: 'Preliminary design phase' },
  { name: 'phase:detailed', color: '81d4fa', description: 'Detailed design phase' },
  { name: 'phase:critical', color: '4fc3f7', description: 'Critical design phase' },
  { name: 'phase:final', color: '29b6f6', description: 'Final design phase' },
  
  // Discipline labels
  { name: 'discipline:mechanical', color: 'f3e5f5', description: 'Mechanical engineering' },
  { name: 'discipline:electrical', color: 'fff3e0', description: 'Electrical engineering' },
  { name: 'discipline:firmware', color: 'e8f5e8', description: 'Firmware development' },
  { name: 'discipline:software', color: 'e3f2fd', description: 'Software development' },
  
  // Complexity labels
  { name: 'complexity:low', color: 'c8e6c9', description: 'Low complexity task' },
  { name: 'complexity:medium', color: 'fff9c4', description: 'Medium complexity task' },
  { name: 'complexity:high', color: 'ffcdd2', description: 'High complexity task' },
  
  // AI and automation labels
  { name: 'ai-assistable', color: 'd1c4e9', description: 'Task can be AI-assisted' },
  { name: 'manual-edit', color: 'ffab91', description: 'Contains manual edits - preserve' },
  { name: 'auto-generated', color: 'b0bec5', description: 'Auto-generated content' },
  
  // Requirements labels
  { name: 'requirements-gap', color: 'f8bbd9', description: 'Requirements gap identified' },
  { name: 'requirements-incomplete', color: 'f48fb1', description: 'Incomplete requirement' },
  
  // Priority labels
  { name: 'priority:high', color: 'f44336', description: 'High priority' },
  { name: 'priority:medium', color: 'ff9800', description: 'Medium priority' },
  { name: 'priority:low', color: '4caf50', description: 'Low priority' },
];

// Default milestone definitions
export const DEFAULT_MILESTONES: GitHubMilestone[] = [
  { title: 'Concept Design Review', description: 'Complete concept phase deliverables' },
  { title: 'Preliminary Design Review', description: 'Complete preliminary phase deliverables' },
  { title: 'Detailed Design Review', description: 'Complete detailed phase deliverables' },
  { title: 'Critical Design Review', description: 'Complete critical phase deliverables' },
  { title: 'Final Design Review', description: 'Complete final phase deliverables' },
];
