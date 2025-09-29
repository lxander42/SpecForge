import { describe, it, expect } from 'vitest';
import {
  InitCommandSchema,
  RefactorCommandSchema,
  PlanCommandSchema,
  BaselineCommandSchema,
  LabelsCommandSchema,
  GitHubConfigSchema,
  AIConfigSchema,
  OperationResultSchema,
  ChangeSummarySchema,
  validateInitCommand,
  validateRefactorCommand,
  validateGitHubConfig,
  getSchema,
  validateWithSchema,
  SCHEMA_REGISTRY,
} from '@src/lib/schema';

describe('Schema Module', () => {
  describe('Command schemas', () => {
    it('should validate init command', () => {
      const validInit = {
        org: 'test-org',
        repo: 'test-repo',
        disciplines: ['Mechanical', 'Electrical'],
        complexity: 'medium',
        dryRun: false,
        json: false,
      };

      const result = validateInitCommand(validInit);
      expect(result).toEqual(validInit);
    });

    it('should reject invalid init command', () => {
      const invalidInit = {
        org: 'test-org',
        repo: 'test-repo',
        disciplines: [], // Empty array not allowed
        complexity: 'medium',
      };

      expect(() => validateInitCommand(invalidInit)).toThrow();
    });

    it('should validate refactor command', () => {
      const validRefactor = {
        org: 'test-org',
        repo: 'test-repo',
        reconcile: true,
        prune: false,
        dryRun: true,
        json: false,
      };

      const result = validateRefactorCommand(validRefactor);
      expect(result).toEqual(validRefactor);
    });

    it('should apply defaults for refactor command', () => {
      const minimalRefactor = {
        org: 'test-org',
        repo: 'test-repo',
      };

      const result = validateRefactorCommand(minimalRefactor);
      expect(result.reconcile).toBe(false);
      expect(result.prune).toBe(false);
      expect(result.dryRun).toBe(false);
      expect(result.json).toBe(false);
    });

    it('should validate plan command with optional fields', () => {
      const fullPlan = {
        org: 'test-org',
        repo: 'test-repo',
        disciplines: ['Software'],
        complexity: 'low',
        dryRun: true,
        json: true,
      };

      const result = PlanCommandSchema.parse(fullPlan);
      expect(result).toEqual(fullPlan);

      const minimalPlan = {
        dryRun: false,
        json: false,
      };

      const result2 = PlanCommandSchema.parse(minimalPlan);
      expect(result2.org).toBeUndefined();
      expect(result2.disciplines).toBeUndefined();
    });

    it('should validate baseline command', () => {
      const validBaseline = {
        org: 'test-org',
        repo: 'test-repo',
        tag: 'v1.0-reqs',
        approve: true,
        approver: 'john.doe@example.com',
        dryRun: false,
        json: true,
      };

      const result = BaselineCommandSchema.parse(validBaseline);
      expect(result).toEqual(validBaseline);
    });

    it('should validate labels command', () => {
      const validLabels = {
        org: 'test-org',
        repo: 'test-repo',
        dryRun: true,
        json: false,
      };

      const result = LabelsCommandSchema.parse(validLabels);
      expect(result).toEqual(validLabels);
    });
  });

  describe('Configuration schemas', () => {
    it('should validate GitHub configuration', () => {
      const validGitHubConfig = {
        token: 'ghp_test_token',
        org: 'test-org',
        repo: 'test-repo',
      };

      const result = validateGitHubConfig(validGitHubConfig);
      expect(result).toEqual(validGitHubConfig);
    });

    it('should reject invalid GitHub configuration', () => {
      const invalidGitHubConfig = {
        token: '', // Empty token not allowed
        org: 'test-org',
        repo: 'test-repo',
      };

      expect(() => validateGitHubConfig(invalidGitHubConfig)).toThrow();
    });

    it('should validate AI configuration', () => {
      const validAIConfig = {
        provider: 'openai',
        apiKey: 'sk-test-key',
        model: 'gpt-4',
      };

      const result = AIConfigSchema.parse(validAIConfig);
      expect(result).toEqual(validAIConfig);
    });

    it('should validate AI provider enum', () => {
      const validProviders = ['openai', 'azure-openai', 'anthropic', 'bedrock', 'local'];
      
      validProviders.forEach(provider => {
        const config = { provider };
        expect(() => AIConfigSchema.parse(config)).not.toThrow();
      });

      const invalidConfig = { provider: 'invalid-provider' };
      expect(() => AIConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should validate optional AI configuration fields', () => {
      const minimalConfig = {
        provider: 'local',
      };

      const result = AIConfigSchema.parse(minimalConfig);
      expect(result.provider).toBe('local');
      expect(result.apiKey).toBeUndefined();
      expect(result.model).toBeUndefined();
      expect(result.endpoint).toBeUndefined();
    });

    it('should validate AI endpoint URL', () => {
      const validConfig = {
        provider: 'local',
        endpoint: 'http://localhost:8080/api',
      };

      expect(() => AIConfigSchema.parse(validConfig)).not.toThrow();

      const invalidConfig = {
        provider: 'local',
        endpoint: 'not-a-url',
      };

      expect(() => AIConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('Result schemas', () => {
    it('should validate operation result', () => {
      const validResult = {
        success: true,
        message: 'Operation completed successfully',
        data: { created: 5, updated: 2 },
        errors: [],
        warnings: ['Some minor warning'],
      };

      const result = OperationResultSchema.parse(validResult);
      expect(result).toEqual(validResult);
    });

    it('should validate minimal operation result', () => {
      const minimalResult = {
        success: false,
        message: 'Operation failed',
      };

      const result = OperationResultSchema.parse(minimalResult);
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toBeUndefined();
    });

    it('should validate change summary', () => {
      const validSummary = {
        changes: [
          {
            id: 'change-1',
            type: 'added',
            resource: 'issue',
            before: null,
            after: { title: 'New issue' },
            timestamp: '2024-01-01T12:00:00Z',
          },
        ],
        statistics: {
          added: 1,
          modified: 0,
          removed: 0,
          preserved: 2,
        },
        hasConflicts: false,
        requiresApproval: true,
      };

      const result = ChangeSummarySchema.parse(validSummary);
      expect(result).toEqual(validSummary);
    });

    it('should validate change record types', () => {
      const validTypes = ['added', 'changed', 'removed'];
      const validResources = ['issue', 'label', 'milestone', 'project', 'requirement'];

      validTypes.forEach(type => {
        validResources.forEach(resource => {
          const change = {
            id: 'test-change',
            type,
            resource,
            timestamp: '2024-01-01T12:00:00Z',
          };

          expect(() => ChangeSummarySchema.parse({
            changes: [change],
            statistics: { added: 0, modified: 0, removed: 0, preserved: 0 },
            hasConflicts: false,
            requiresApproval: false,
          })).not.toThrow();
        });
      });
    });
  });

  describe('Schema registry', () => {
    it('should contain all expected schemas', () => {
      expect(SCHEMA_REGISTRY).toHaveProperty('init-command');
      expect(SCHEMA_REGISTRY).toHaveProperty('refactor-command');
      expect(SCHEMA_REGISTRY).toHaveProperty('github-config');
      expect(SCHEMA_REGISTRY).toHaveProperty('operation-result');
    });

    it('should retrieve schemas by name', () => {
      const initSchema = getSchema('init-command');
      expect(initSchema).toBe(InitCommandSchema);

      const unknownSchema = getSchema('unknown-schema');
      expect(unknownSchema).toBeUndefined();
    });

    it('should validate with schema by name', () => {
      const validInit = {
        org: 'test-org',
        repo: 'test-repo',
        disciplines: ['Mechanical'],
        complexity: 'low',
        dryRun: false,
        json: false,
      };

      const result = validateWithSchema('init-command', validInit);
      expect(result).toEqual(validInit);

      expect(() => validateWithSchema('unknown-schema', {})).toThrow();
    });
  });

  describe('Discipline and complexity enums', () => {
    it('should validate discipline enum values', () => {
      const validDisciplines = ['Mechanical', 'Electrical', 'Firmware', 'Software'];
      
      validDisciplines.forEach(discipline => {
        const command = {
          org: 'test-org',
          repo: 'test-repo',
          disciplines: [discipline],
          complexity: 'medium',
          dryRun: false,
          json: false,
        };
        
        expect(() => InitCommandSchema.parse(command)).not.toThrow();
      });

      const invalidCommand = {
        org: 'test-org',
        repo: 'test-repo',
        disciplines: ['InvalidDiscipline'],
        complexity: 'medium',
        dryRun: false,
        json: false,
      };

      expect(() => InitCommandSchema.parse(invalidCommand)).toThrow();
    });

    it('should validate complexity enum values', () => {
      const validComplexities = ['low', 'medium', 'high'];
      
      validComplexities.forEach(complexity => {
        const command = {
          org: 'test-org',
          repo: 'test-repo',
          disciplines: ['Mechanical'],
          complexity,
          dryRun: false,
          json: false,
        };
        
        expect(() => InitCommandSchema.parse(command)).not.toThrow();
      });

      const invalidCommand = {
        org: 'test-org',
        repo: 'test-repo',
        disciplines: ['Mechanical'],
        complexity: 'invalid',
        dryRun: false,
        json: false,
      };

      expect(() => InitCommandSchema.parse(invalidCommand)).toThrow();
    });
  });

  describe('Strict validation', () => {
    it('should reject additional properties in commands', () => {
      const commandWithExtra = {
        org: 'test-org',
        repo: 'test-repo',
        disciplines: ['Mechanical'],
        complexity: 'medium',
        dryRun: false,
        json: false,
        extraProperty: 'should-not-be-allowed',
      };

      expect(() => InitCommandSchema.parse(commandWithExtra)).toThrow();
    });

    it('should allow only specified boolean values', () => {
      const validCommand = {
        org: 'test-org',
        repo: 'test-repo',
        reconcile: true,
        prune: false,
        dryRun: false,
        json: false,
      };

      expect(() => RefactorCommandSchema.parse(validCommand)).not.toThrow();

      const invalidCommand = {
        org: 'test-org',
        repo: 'test-repo',
        reconcile: 'true', // String instead of boolean
        prune: false,
        dryRun: false,
        json: false,
      };

      expect(() => RefactorCommandSchema.parse(invalidCommand)).toThrow();
    });
  });
});
