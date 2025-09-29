import { describe, it, expect } from 'vitest';
import { WbsItemSchema, validateWbsItem } from '@src/models/entities';

describe('WbsItem Entity', () => {
  it('should validate a valid WBS item', () => {
    const validWbsItem = {
      id: 'WBS-001',
      title: 'Design power supply circuit',
      phase: 'detailed',
      disciplineTags: ['Electrical'],
      aiAssistable: false,
      dependencies: ['WBS-002', 'WBS-003'],
    };

    const result = validateWbsItem(validWbsItem);
    expect(result).toEqual(validWbsItem);
  });

  it('should require all mandatory fields', () => {
    const invalidWbsItem = {
      id: 'WBS-001',
      title: 'Design power supply circuit',
      // Missing phase, disciplineTags, aiAssistable, dependencies
    };

    expect(() => validateWbsItem(invalidWbsItem)).toThrow();
  });

  it('should validate phase enum', () => {
    const validPhases = ['concept', 'prelim', 'detailed', 'critical', 'final'];
    
    validPhases.forEach(phase => {
      const wbsItem = {
        id: 'WBS-001',
        title: 'Test task',
        phase,
        disciplineTags: ['Mechanical'],
        aiAssistable: true,
        dependencies: [],
      };
      
      expect(() => validateWbsItem(wbsItem)).not.toThrow();
    });

    // Test invalid phase
    const invalidWbsItem = {
      id: 'WBS-001',
      title: 'Test task',
      phase: 'invalid-phase',
      disciplineTags: ['Mechanical'],
      aiAssistable: true,
      dependencies: [],
    };

    expect(() => validateWbsItem(invalidWbsItem)).toThrow();
  });

  it('should validate discipline tags enum', () => {
    const validDisciplines = ['Mechanical', 'Electrical', 'Firmware', 'Software'];
    
    validDisciplines.forEach(discipline => {
      const wbsItem = {
        id: 'WBS-001',
        title: 'Test task',
        phase: 'concept',
        disciplineTags: [discipline],
        aiAssistable: true,
        dependencies: [],
      };
      
      expect(() => validateWbsItem(wbsItem)).not.toThrow();
    });

    // Test multiple disciplines
    const multiDisciplineItem = {
      id: 'WBS-001',
      title: 'Cross-discipline task',
      phase: 'detailed',
      disciplineTags: ['Mechanical', 'Electrical'],
      aiAssistable: false,
      dependencies: [],
    };

    expect(() => validateWbsItem(multiDisciplineItem)).not.toThrow();

    // Test invalid discipline
    const invalidWbsItem = {
      id: 'WBS-001',
      title: 'Test task',
      phase: 'concept',
      disciplineTags: ['InvalidDiscipline'],
      aiAssistable: true,
      dependencies: [],
    };

    expect(() => validateWbsItem(invalidWbsItem)).toThrow();
  });

  it('should validate AI assistable flag', () => {
    const aiAssistableItem = {
      id: 'WBS-001',
      title: 'Generate documentation template',
      phase: 'concept',
      disciplineTags: ['Software'],
      aiAssistable: true,
      aiHint: 'Create standard project documentation templates',
      dependencies: [],
    };

    const result1 = validateWbsItem(aiAssistableItem);
    expect(result1.aiAssistable).toBe(true);
    expect(result1.aiHint).toBeTruthy();

    const nonAiAssistableItem = {
      id: 'WBS-002',
      title: 'Design circuit topology',
      phase: 'detailed',
      disciplineTags: ['Electrical'],
      aiAssistable: false,
      dependencies: [],
    };

    const result2 = validateWbsItem(nonAiAssistableItem);
    expect(result2.aiAssistable).toBe(false);
    expect(result2.aiHint).toBeUndefined();
  });

  it('should allow optional AI hint', () => {
    const itemWithHint = {
      id: 'WBS-001',
      title: 'Create test procedures',
      phase: 'critical',
      disciplineTags: ['Software'],
      aiAssistable: true,
      aiHint: 'Generate comprehensive test procedure templates based on requirements',
      dependencies: [],
    };

    const result1 = validateWbsItem(itemWithHint);
    expect(result1.aiHint).toBe('Generate comprehensive test procedure templates based on requirements');

    const itemWithoutHint = {
      id: 'WBS-002',
      title: 'Manual design review',
      phase: 'critical',
      disciplineTags: ['Mechanical'],
      aiAssistable: false,
      dependencies: [],
    };

    const result2 = validateWbsItem(itemWithoutHint);
    expect(result2.aiHint).toBeUndefined();
  });

  it('should validate dependencies array', () => {
    const itemWithDependencies = {
      id: 'WBS-003',
      title: 'Final assembly',
      phase: 'final',
      disciplineTags: ['Mechanical'],
      aiAssistable: false,
      dependencies: ['WBS-001', 'WBS-002'],
    };

    const result = validateWbsItem(itemWithDependencies);
    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies).toContain('WBS-001');
    expect(result.dependencies).toContain('WBS-002');

    const itemWithoutDependencies = {
      id: 'WBS-004',
      title: 'Initial concept',
      phase: 'concept',
      disciplineTags: ['Mechanical'],
      aiAssistable: true,
      dependencies: [],
    };

    const result2 = validateWbsItem(itemWithoutDependencies);
    expect(result2.dependencies).toHaveLength(0);
  });

  it('should validate AI policy enforcement', () => {
    // Tasks that should NOT be AI-assistable
    const designTasks = [
      {
        id: 'WBS-001',
        title: 'Design power supply circuit',
        phase: 'detailed',
        disciplineTags: ['Electrical'],
        aiAssistable: false,
        dependencies: [],
      },
      {
        id: 'WBS-002',
        title: 'Perform FEA analysis',
        phase: 'detailed',
        disciplineTags: ['Mechanical'],
        aiAssistable: false,
        dependencies: [],
      },
      {
        id: 'WBS-003',
        title: 'Safety verification testing',
        phase: 'critical',
        disciplineTags: ['Electrical', 'Mechanical'],
        aiAssistable: false,
        dependencies: [],
      },
    ];

    designTasks.forEach(task => {
      expect(() => validateWbsItem(task)).not.toThrow();
      const result = validateWbsItem(task);
      expect(result.aiAssistable).toBe(false);
    });

    // Tasks that CAN be AI-assistable
    const documentationTasks = [
      {
        id: 'WBS-004',
        title: 'Generate project documentation',
        phase: 'concept',
        disciplineTags: ['Software'],
        aiAssistable: true,
        aiHint: 'Create standard project documentation templates',
        dependencies: [],
      },
      {
        id: 'WBS-005',
        title: 'Create test case templates',
        phase: 'critical',
        disciplineTags: ['Software'],
        aiAssistable: true,
        aiHint: 'Generate test case templates based on requirements',
        dependencies: [],
      },
    ];

    documentationTasks.forEach(task => {
      expect(() => validateWbsItem(task)).not.toThrow();
      const result = validateWbsItem(task);
      expect(result.aiAssistable).toBe(true);
      expect(result.aiHint).toBeTruthy();
    });
  });

  it('should validate cross-discipline items', () => {
    const crossDisciplineItem = {
      id: 'WBS-001',
      title: 'System integration testing',
      phase: 'critical',
      disciplineTags: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
      aiAssistable: false,
      dependencies: ['WBS-002', 'WBS-003', 'WBS-004'],
    };

    const result = validateWbsItem(crossDisciplineItem);
    expect(result.disciplineTags).toHaveLength(4);
    expect(result.dependencies).toHaveLength(3);
  });

  it('should validate phase-appropriate tasks', () => {
    const conceptTask = {
      id: 'WBS-001',
      title: 'Requirements analysis',
      phase: 'concept',
      disciplineTags: ['Software'],
      aiAssistable: true,
      aiHint: 'Analyze and categorize requirements',
      dependencies: [],
    };

    const finalTask = {
      id: 'WBS-002',
      title: 'Production documentation',
      phase: 'final',
      disciplineTags: ['Mechanical', 'Electrical'],
      aiAssistable: true,
      aiHint: 'Generate production documentation templates',
      dependencies: ['WBS-001'],
    };

    expect(() => validateWbsItem(conceptTask)).not.toThrow();
    expect(() => validateWbsItem(finalTask)).not.toThrow();

    const conceptResult = validateWbsItem(conceptTask);
    expect(conceptResult.phase).toBe('concept');

    const finalResult = validateWbsItem(finalTask);
    expect(finalResult.phase).toBe('final');
  });

  it('should validate schema structure', () => {
    const schema = WbsItemSchema;
    
    expect(schema.shape.id).toBeDefined();
    expect(schema.shape.title).toBeDefined();
    expect(schema.shape.phase).toBeDefined();
    expect(schema.shape.disciplineTags).toBeDefined();
    expect(schema.shape.aiAssistable).toBeDefined();
    expect(schema.shape.aiHint).toBeDefined();
    expect(schema.shape.dependencies).toBeDefined();
  });
});
