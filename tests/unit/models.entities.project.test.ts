import { describe, it, expect } from 'vitest';
import { ProjectSchema, validateProject, type Project } from '@src/models/entities';

describe('Project Entity', () => {
  it('should validate a valid project', () => {
    const validProject = {
      id: 'hardware-project-001',
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['Mechanical', 'Electrical'],
      complexity: 'medium',
    };

    const result = validateProject(validProject);
    expect(result).toEqual(validProject);
  });

  it('should require all mandatory fields', () => {
    const invalidProject = {
      id: 'hardware-project-001',
      org: 'test-org',
      // Missing repo, disciplines, complexity
    };

    expect(() => validateProject(invalidProject)).toThrow();
  });

  it('should validate disciplines enum', () => {
    const validDisciplines = ['Mechanical', 'Electrical', 'Firmware', 'Software'];
    
    validDisciplines.forEach(discipline => {
      const project = {
        id: 'test-project',
        org: 'test-org',
        repo: 'test-repo',
        disciplines: [discipline],
        complexity: 'low',
      };
      
      expect(() => validateProject(project)).not.toThrow();
    });

    // Test invalid discipline
    const invalidProject = {
      id: 'test-project',
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['InvalidDiscipline'],
      complexity: 'low',
    };

    expect(() => validateProject(invalidProject)).toThrow();
  });

  it('should validate complexity enum', () => {
    const validComplexities = ['low', 'medium', 'high'];
    
    validComplexities.forEach(complexity => {
      const project = {
        id: 'test-project',
        org: 'test-org',
        repo: 'test-repo',
        disciplines: ['Mechanical'],
        complexity,
      };
      
      expect(() => validateProject(project)).not.toThrow();
    });

    // Test invalid complexity
    const invalidProject = {
      id: 'test-project',
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['Mechanical'],
      complexity: 'invalid',
    };

    expect(() => validateProject(invalidProject)).toThrow();
  });

  it('should require at least one discipline', () => {
    const invalidProject = {
      id: 'test-project',
      org: 'test-org',
      repo: 'test-repo',
      disciplines: [],
      complexity: 'low',
    };

    expect(() => validateProject(invalidProject)).toThrow();
  });

  it('should allow multiple disciplines', () => {
    const project = {
      id: 'test-project',
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
      complexity: 'high',
    };

    const result = validateProject(project);
    expect(result.disciplines).toHaveLength(4);
  });

  it('should allow optional constitution field', () => {
    const projectWithConstitution = {
      id: 'test-project',
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['Mechanical'],
      complexity: 'low',
      constitution: '/path/to/constitution.md',
    };

    const result = validateProject(projectWithConstitution);
    expect(result.constitution).toBe('/path/to/constitution.md');

    const projectWithoutConstitution = {
      id: 'test-project',
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['Mechanical'],
      complexity: 'low',
    };

    const result2 = validateProject(projectWithoutConstitution);
    expect(result2.constitution).toBeUndefined();
  });

  it('should validate project schema structure', () => {
    const schema = ProjectSchema;
    
    expect(schema.shape.id).toBeDefined();
    expect(schema.shape.org).toBeDefined();
    expect(schema.shape.repo).toBeDefined();
    expect(schema.shape.disciplines).toBeDefined();
    expect(schema.shape.complexity).toBeDefined();
    expect(schema.shape.constitution).toBeDefined();
  });
});
