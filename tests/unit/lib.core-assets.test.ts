import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  loadConfig,
  saveConfig,
  getConfig,
  resetConfigCache,
  validateGitHubConfig,
  getGitHubToken,
  isDryRun,
} from '@src/lib/config';
import {
  promptGitHubDetails,
  promptProjectDetails,
  confirmAction,
  validateEmail,
  validateRequired,
} from '@src/lib/prompts';
import {
  displayLogo,
  displaySuccess,
  displayError,
  ProgressIndicator,
  COLORS,
} from '@src/lib/ascii';
import {
  isTaskAIAssistable,
  generateAIHint,
  AIRuleEngine,
  TaskCategory,
  categorizeTask,
} from '@src/lib/rules';

// Mock inquirer for prompt tests
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

describe('Config Module', () => {
  const testConfigDir = join(process.cwd(), 'temp-test-config');

  beforeEach(() => {
    resetConfigCache();
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
    mkdirSync(testConfigDir, { recursive: true });
  });

  afterEach(() => {
    resetConfigCache();
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  it('should load default configuration', () => {
    const config = getConfig();
    
    expect(config).toBeDefined();
    expect(config.behavior?.dryRun).toBe(false);
    expect(config.behavior?.verbose).toBe(false);
    expect(config.paths?.requirements).toBe('requirements/');
  });

  it('should validate GitHub configuration', () => {
    const validConfig = {
      github: {
        token: 'test-token',
        org: 'test-org',
        repo: 'test-repo',
      },
    };

    expect(() => validateGitHubConfig(validConfig as any)).not.toThrow();

    const invalidConfig = {
      github: {
        // missing token
        org: 'test-org',
        repo: 'test-repo',
      },
    };

    expect(() => validateGitHubConfig(invalidConfig as any)).toThrow();
  });

  it('should get GitHub token from config', () => {
    const config = {
      github: {
        token: 'test-token',
        org: 'test-org',
        repo: 'test-repo',
      },
    };

    expect(getGitHubToken(config as any)).toBe('test-token');
  });

  it('should check dry run mode', () => {
    const dryRunConfig = {
      behavior: {
        dryRun: true,
      },
    };

    const normalConfig = {
      behavior: {
        dryRun: false,
      },
    };

    expect(isDryRun(dryRunConfig as any)).toBe(true);
    expect(isDryRun(normalConfig as any)).toBe(false);
  });

  it('should load environment variables', () => {
    const originalToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'env-token';

    try {
      resetConfigCache();
      const config = getConfig();
      expect(config.github?.token).toBe('env-token');
    } finally {
      if (originalToken) {
        process.env.GITHUB_TOKEN = originalToken;
      } else {
        delete process.env.GITHUB_TOKEN;
      }
    }
  });
});

describe('Prompts Module', () => {
  let inquirer: any;

  beforeEach(async () => {
    inquirer = await import('inquirer');
    vi.clearAllMocks();
  });

  it('should validate email addresses', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('invalid-email')).toContain('valid email');
  });

  it('should validate required fields', () => {
    expect(validateRequired('some input')).toBe(true);
    expect(validateRequired('')).toContain('required');
    expect(validateRequired('   ')).toContain('required');
  });

  it('should prompt for GitHub details', async () => {
    const mockAnswers = {
      org: 'test-org',
      repo: 'test-repo',
    };

    (inquirer.default.prompt as any).mockResolvedValue(mockAnswers);

    const result = await promptGitHubDetails();
    expect(result).toEqual(mockAnswers);
    expect(inquirer.default.prompt).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'org' }),
        expect.objectContaining({ name: 'repo' }),
      ])
    );
  });

  it('should prompt for project details', async () => {
    const mockAnswers = {
      disciplines: ['Mechanical', 'Electrical'],
      complexity: 'medium',
    };

    (inquirer.default.prompt as any).mockResolvedValue(mockAnswers);

    const result = await promptProjectDetails();
    expect(result).toEqual(mockAnswers);
    expect(result.disciplines).toContain('Mechanical');
    expect(result.complexity).toBe('medium');
  });

  it('should prompt for confirmation', async () => {
    (inquirer.default.prompt as any).mockResolvedValue({ confirmed: true });

    const result = await confirmAction('Are you sure?');
    expect(result).toBe(true);
  });
});

describe('ASCII Module', () => {
  it('should provide color utilities', () => {
    expect(COLORS.primary).toBeDefined();
    expect(COLORS.success).toBeDefined();
    expect(COLORS.error).toBeDefined();
  });

  it('should display status messages', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    displaySuccess('Test success');
    displayError('Test error');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('❌'));

    consoleSpy.mockRestore();
  });

  it('should create progress indicators', () => {
    const progress = new ProgressIndicator('Loading...', 'spinner');
    expect(progress).toBeDefined();
    
    // Test that start/stop don't throw errors
    progress.start();
    progress.stop('Complete!');
  });

  it('should display logo', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    displayLogo();
    expect(consoleSpy).toHaveBeenCalled();

    displayLogo(true); // compact version
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe('Rules Module', () => {
  describe('Task categorization', () => {
    it('should categorize documentation tasks', () => {
      expect(categorizeTask('Create documentation template')).toBe(TaskCategory.DOCUMENTATION);
      expect(categorizeTask('Generate user manual')).toBe(TaskCategory.DOCUMENTATION);
    });

    it('should categorize design tasks', () => {
      expect(categorizeTask('Design power supply circuit')).toBe(TaskCategory.DESIGN);
      expect(categorizeTask('Create mechanical housing')).toBe(TaskCategory.DESIGN);
    });

    it('should categorize analysis tasks', () => {
      expect(categorizeTask('Perform FEA analysis')).toBe(TaskCategory.ANALYSIS);
      expect(categorizeTask('Calculate thermal performance')).toBe(TaskCategory.ANALYSIS);
    });

    it('should categorize verification tasks', () => {
      expect(categorizeTask('Verify safety requirements')).toBe(TaskCategory.VERIFICATION);
      expect(categorizeTask('Validate system requirements')).toBe(TaskCategory.VERIFICATION);
    });
  });

  describe('AI policy enforcement', () => {
    it('should allow AI assistance for documentation tasks', () => {
      const task = {
        title: 'Generate project documentation',
        phase: 'concept' as const,
        disciplines: ['Software' as const],
        category: TaskCategory.DOCUMENTATION,
      };

      expect(isTaskAIAssistable(task)).toBe(true);
    });

    it('should prohibit AI assistance for circuit design', () => {
      const task = {
        title: 'Design power supply circuit',
        phase: 'detailed' as const,
        disciplines: ['Electrical' as const],
        category: TaskCategory.DESIGN,
      };

      expect(isTaskAIAssistable(task)).toBe(false);
    });

    it('should prohibit AI assistance for safety verification', () => {
      const task = {
        title: 'Safety verification testing',
        phase: 'critical' as const,
        disciplines: ['Electrical' as const, 'Mechanical' as const],
        category: TaskCategory.VERIFICATION,
      };

      expect(isTaskAIAssistable(task)).toBe(false);
    });

    it('should prohibit AI assistance for FEA analysis', () => {
      const task = {
        title: 'Perform FEA stress analysis',
        phase: 'detailed' as const,
        disciplines: ['Mechanical' as const],
        category: TaskCategory.ANALYSIS,
      };

      expect(isTaskAIAssistable(task)).toBe(false);
    });
  });

  describe('AI hint generation', () => {
    it('should generate hints for allowed tasks', () => {
      const task = {
        title: 'Create test procedures',
        phase: 'critical' as const,
        disciplines: ['Software' as const],
        category: TaskCategory.TESTING,
      };

      const hint = generateAIHint(task);
      expect(hint).toBeTruthy();
      expect(hint).toContain('test');
    });

    it('should not generate hints for prohibited tasks', () => {
      const task = {
        title: 'Design circuit topology',
        phase: 'detailed' as const,
        disciplines: ['Electrical' as const],
        category: TaskCategory.DESIGN,
      };

      const hint = generateAIHint(task);
      expect(hint).toBeNull();
    });

    it('should include human review requirement for requirements drafting', () => {
      const task = {
        title: 'Draft functional requirements',
        phase: 'concept' as const,
        disciplines: ['Software' as const],
        category: TaskCategory.REQUIREMENTS,
      };

      const hint = generateAIHint(task);
      expect(hint).toBeTruthy();
      expect(hint?.toLowerCase()).toContain('human review');
    });
  });

  describe('Rule engine', () => {
    it('should evaluate tasks against rules', () => {
      const engine = new AIRuleEngine();
      
      const documentationTask = {
        title: 'Generate documentation templates',
        phase: 'concept' as const,
        disciplines: ['Software' as const],
      };

      const evaluation = engine.evaluateTask(documentationTask);
      expect(evaluation.isAIAssistable).toBe(true);
      expect(evaluation.violations).toHaveLength(0);
    });

    it('should detect rule violations', () => {
      const engine = new AIRuleEngine();
      engine.addDisciplineRules('Electrical');
      
      const designTask = {
        title: 'Design power supply circuit',
        phase: 'detailed' as const,
        disciplines: ['Electrical' as const],
      };

      const evaluation = engine.evaluateTask(designTask);
      expect(evaluation.isAIAssistable).toBe(false);
      expect(evaluation.violations.length).toBeGreaterThan(0);
    });

    it('should add phase-specific rules', () => {
      const engine = new AIRuleEngine();
      engine.addPhaseRules('critical');
      
      const verificationTask = {
        title: 'Critical design verification',
        phase: 'critical' as const,
        disciplines: ['Mechanical' as const],
      };

      const evaluation = engine.evaluateTask(verificationTask);
      expect(evaluation.isAIAssistable).toBe(false);
    });
  });
});
