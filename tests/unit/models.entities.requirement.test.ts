import { describe, it, expect } from 'vitest';
import { RequirementSchema, validateRequirement } from '@src/models/entities';

describe('Requirement Entity', () => {
  it('should validate a valid requirement', () => {
    const validRequirement = {
      id: 'FR-001',
      section: 'functional',
      text: 'System shall operate within specified temperature range',
      acceptanceCriteria: 'System operates from -20°C to +60°C without failure',
      verificationMethod: 'Test',
    };

    const result = validateRequirement(validRequirement);
    expect(result).toEqual(validRequirement);
  });

  it('should require all mandatory fields', () => {
    const invalidRequirement = {
      id: 'FR-001',
      section: 'functional',
      // Missing text, acceptanceCriteria, verificationMethod
    };

    expect(() => validateRequirement(invalidRequirement)).toThrow();
  });

  it('should validate requirement section enum', () => {
    const validSections = [
      'functional',
      'performance',
      'environmental',
      'interfaces',
      'safety',
      'verification',
      'acceptance',
    ];
    
    validSections.forEach(section => {
      const requirement = {
        id: 'REQ-001',
        section,
        text: 'Test requirement',
        acceptanceCriteria: 'Test criteria',
        verificationMethod: 'Inspection',
      };
      
      expect(() => validateRequirement(requirement)).not.toThrow();
    });

    // Test invalid section
    const invalidRequirement = {
      id: 'REQ-001',
      section: 'invalid-section',
      text: 'Test requirement',
      acceptanceCriteria: 'Test criteria',
      verificationMethod: 'Inspection',
    };

    expect(() => validateRequirement(invalidRequirement)).toThrow();
  });

  it('should validate verification method enum', () => {
    const validMethods = ['Inspection', 'Test', 'Analysis', 'Demonstration'];
    
    validMethods.forEach(method => {
      const requirement = {
        id: 'REQ-001',
        section: 'functional',
        text: 'Test requirement',
        acceptanceCriteria: 'Test criteria',
        verificationMethod: method,
      };
      
      expect(() => validateRequirement(requirement)).not.toThrow();
    });

    // Test invalid verification method
    const invalidRequirement = {
      id: 'REQ-001',
      section: 'functional',
      text: 'Test requirement',
      acceptanceCriteria: 'Test criteria',
      verificationMethod: 'InvalidMethod',
    };

    expect(() => validateRequirement(invalidRequirement)).toThrow();
  });

  it('should validate requirement ID format', () => {
    const validIds = [
      'FR-001',
      'PR-002',
      'ER-003',
      'IR-004',
      'SR-005',
      'VR-006',
      'AR-007',
      'REQ-001',
      'FUNC-001',
    ];

    validIds.forEach(id => {
      const requirement = {
        id,
        section: 'functional',
        text: 'Test requirement',
        acceptanceCriteria: 'Test criteria',
        verificationMethod: 'Inspection',
      };

      expect(() => validateRequirement(requirement)).not.toThrow();
    });
  });

  it('should validate functional requirements', () => {
    const functionalRequirement = {
      id: 'FR-001',
      section: 'functional',
      text: 'The system shall provide user authentication',
      acceptanceCriteria: 'Users can log in with valid credentials and are denied access with invalid credentials',
      verificationMethod: 'Test',
    };

    const result = validateRequirement(functionalRequirement);
    expect(result.section).toBe('functional');
    expect(result.id).toMatch(/FR-/);
  });

  it('should validate performance requirements', () => {
    const performanceRequirement = {
      id: 'PR-001',
      section: 'performance',
      text: 'The system shall respond to user inputs within 100ms',
      acceptanceCriteria: 'Response time measured under normal load conditions is ≤ 100ms',
      verificationMethod: 'Test',
    };

    const result = validateRequirement(performanceRequirement);
    expect(result.section).toBe('performance');
    expect(result.verificationMethod).toBe('Test');
  });

  it('should validate environmental requirements', () => {
    const environmentalRequirement = {
      id: 'ER-001',
      section: 'environmental',
      text: 'The system shall operate in temperature range -20°C to +60°C',
      acceptanceCriteria: 'System functions normally at temperature extremes and transitions',
      verificationMethod: 'Test',
    };

    const result = validateRequirement(environmentalRequirement);
    expect(result.section).toBe('environmental');
  });

  it('should validate safety requirements', () => {
    const safetyRequirement = {
      id: 'SR-001',
      section: 'safety',
      text: 'The system shall fail to a safe state in case of power loss',
      acceptanceCriteria: 'System enters safe mode within 500ms of power interruption',
      verificationMethod: 'Test',
    };

    const result = validateRequirement(safetyRequirement);
    expect(result.section).toBe('safety');
  });

  it('should validate verification methods appropriately', () => {
    const testRequirement = {
      id: 'REQ-001',
      section: 'performance',
      text: 'System response time requirement',
      acceptanceCriteria: 'Response time < 100ms',
      verificationMethod: 'Test',
    };

    const inspectionRequirement = {
      id: 'REQ-002',
      section: 'interfaces',
      text: 'Connector type requirement',
      acceptanceCriteria: 'Uses USB-C connector',
      verificationMethod: 'Inspection',
    };

    const analysisRequirement = {
      id: 'REQ-003',
      section: 'environmental',
      text: 'Thermal performance requirement',
      acceptanceCriteria: 'Maximum temperature rise 40°C',
      verificationMethod: 'Analysis',
    };

    const demonstrationRequirement = {
      id: 'REQ-004',
      section: 'functional',
      text: 'User interface requirement',
      acceptanceCriteria: 'Intuitive navigation',
      verificationMethod: 'Demonstration',
    };

    expect(() => validateRequirement(testRequirement)).not.toThrow();
    expect(() => validateRequirement(inspectionRequirement)).not.toThrow();
    expect(() => validateRequirement(analysisRequirement)).not.toThrow();
    expect(() => validateRequirement(demonstrationRequirement)).not.toThrow();
  });

  it('should validate schema structure', () => {
    const schema = RequirementSchema;
    
    expect(schema.shape.id).toBeDefined();
    expect(schema.shape.section).toBeDefined();
    expect(schema.shape.text).toBeDefined();
    expect(schema.shape.acceptanceCriteria).toBeDefined();
    expect(schema.shape.verificationMethod).toBeDefined();
  });
});
