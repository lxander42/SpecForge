import { describe, it, expect } from 'vitest';
import { RequirementsPackageSchema, validateRequirementsPackage } from '@src/models/entities';

describe('RequirementsPackage Entity', () => {
  it('should validate a valid requirements package', () => {
    const validPackage = {
      path: 'requirements/',
      version: '1.0.0',
      baselineTag: 'v1.0-reqs',
      sections: {
        functional: 'functional-requirements.md',
        performance: 'performance-requirements.md',
        environmental: 'environmental-requirements.md',
        interfaces: 'interface-requirements.md',
        safety: 'safety-requirements.md',
        verification: 'verification-methods.md',
        acceptance: 'acceptance-criteria.md',
      },
    };

    const result = validateRequirementsPackage(validPackage);
    expect(result).toEqual(validPackage);
  });

  it('should require all mandatory fields', () => {
    const invalidPackage = {
      path: 'requirements/',
      version: '1.0.0',
      // Missing sections
    };

    expect(() => validateRequirementsPackage(invalidPackage)).toThrow();
  });

  it('should validate semantic versioning format', () => {
    const validVersions = ['0.1.0', '1.0.0', '2.3.4', '10.20.30'];
    
    validVersions.forEach(version => {
      const pkg = {
        path: 'requirements/',
        version,
        sections: {
          functional: 'functional.md',
          performance: 'performance.md',
          environmental: 'environmental.md',
          interfaces: 'interfaces.md',
          safety: 'safety.md',
          verification: 'verification.md',
          acceptance: 'acceptance.md',
        },
      };
      
      expect(() => validateRequirementsPackage(pkg)).not.toThrow();
    });

    const invalidVersions = ['1.0', 'v1.0.0', '1.0.0-alpha', 'invalid'];
    
    invalidVersions.forEach(version => {
      const pkg = {
        path: 'requirements/',
        version,
        sections: {
          functional: 'functional.md',
          performance: 'performance.md',
          environmental: 'environmental.md',
          interfaces: 'interfaces.md',
          safety: 'safety.md',
          verification: 'verification.md',
          acceptance: 'acceptance.md',
        },
      };
      
      expect(() => validateRequirementsPackage(pkg)).toThrow();
    });
  });

  it('should require all seven sections', () => {
    const requiredSections = [
      'functional',
      'performance',
      'environmental',
      'interfaces',
      'safety',
      'verification',
      'acceptance',
    ];

    // Test with all sections
    const completeSections = requiredSections.reduce((acc, section) => {
      acc[section] = `${section}.md`;
      return acc;
    }, {} as Record<string, string>);

    const validPackage = {
      path: 'requirements/',
      version: '1.0.0',
      sections: completeSections,
    };

    expect(() => validateRequirementsPackage(validPackage)).not.toThrow();

    // Test with missing sections
    requiredSections.forEach(missingSection => {
      const incompleteSections = { ...completeSections };
      delete incompleteSections[missingSection];

      const invalidPackage = {
        path: 'requirements/',
        version: '1.0.0',
        sections: incompleteSections,
      };

      expect(() => validateRequirementsPackage(invalidPackage)).toThrow();
    });
  });

  it('should allow optional baselineTag', () => {
    const packageWithTag = {
      path: 'requirements/',
      version: '1.0.0',
      baselineTag: 'v1.0-baseline',
      sections: {
        functional: 'functional.md',
        performance: 'performance.md',
        environmental: 'environmental.md',
        interfaces: 'interfaces.md',
        safety: 'safety.md',
        verification: 'verification.md',
        acceptance: 'acceptance.md',
      },
    };

    const result1 = validateRequirementsPackage(packageWithTag);
    expect(result1.baselineTag).toBe('v1.0-baseline');

    const packageWithoutTag = {
      path: 'requirements/',
      version: '1.0.0',
      sections: {
        functional: 'functional.md',
        performance: 'performance.md',
        environmental: 'environmental.md',
        interfaces: 'interfaces.md',
        safety: 'safety.md',
        verification: 'verification.md',
        acceptance: 'acceptance.md',
      },
    };

    const result2 = validateRequirementsPackage(packageWithoutTag);
    expect(result2.baselineTag).toBeUndefined();
  });

  it('should validate sections structure', () => {
    const validPackage = {
      path: 'requirements/',
      version: '1.0.0',
      sections: {
        functional: 'functional-requirements.md',
        performance: 'performance-requirements.md',
        environmental: 'environmental-requirements.md',
        interfaces: 'interface-requirements.md',
        safety: 'safety-requirements.md',
        verification: 'verification-methods.md',
        acceptance: 'acceptance-criteria.md',
      },
    };

    const result = validateRequirementsPackage(validPackage);
    
    expect(result.sections.functional).toBe('functional-requirements.md');
    expect(result.sections.performance).toBe('performance-requirements.md');
    expect(result.sections.environmental).toBe('environmental-requirements.md');
    expect(result.sections.interfaces).toBe('interface-requirements.md');
    expect(result.sections.safety).toBe('safety-requirements.md');
    expect(result.sections.verification).toBe('verification-methods.md');
    expect(result.sections.acceptance).toBe('acceptance-criteria.md');
  });

  it('should validate package path format', () => {
    const validPaths = [
      'requirements/',
      'docs/requirements/',
      'project/requirements/',
      'requirements',
    ];

    validPaths.forEach(path => {
      const pkg = {
        path,
        version: '1.0.0',
        sections: {
          functional: 'functional.md',
          performance: 'performance.md',
          environmental: 'environmental.md',
          interfaces: 'interfaces.md',
          safety: 'safety.md',
          verification: 'verification.md',
          acceptance: 'acceptance.md',
        },
      };

      expect(() => validateRequirementsPackage(pkg)).not.toThrow();
    });
  });

  it('should validate schema structure', () => {
    const schema = RequirementsPackageSchema;
    
    expect(schema.shape.path).toBeDefined();
    expect(schema.shape.version).toBeDefined();
    expect(schema.shape.baselineTag).toBeDefined();
    expect(schema.shape.sections).toBeDefined();
  });
});
