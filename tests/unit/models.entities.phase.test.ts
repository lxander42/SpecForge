import { describe, it, expect } from 'vitest';
import { PhaseSchema, DEFAULT_PHASES, type PhaseEntity } from '@src/models/entities';

describe('Phase Entity', () => {
  it('should validate a valid phase', () => {
    const validPhase = {
      key: 'concept',
      gateCriteria: ['Requirements complete', 'Design approved'],
      milestoneId: 123,
    };

    const result = PhaseSchema.parse(validPhase);
    expect(result).toEqual(validPhase);
  });

  it('should require key and gateCriteria fields', () => {
    const invalidPhase = {
      key: 'concept',
      // Missing gateCriteria
    };

    expect(() => PhaseSchema.parse(invalidPhase)).toThrow();
  });

  it('should validate phase key enum', () => {
    const validPhases = ['concept', 'prelim', 'detailed', 'critical', 'final'];
    
    validPhases.forEach(key => {
      const phase = {
        key,
        gateCriteria: ['Test criteria'],
      };
      
      expect(() => PhaseSchema.parse(phase)).not.toThrow();
    });

    // Test invalid phase key
    const invalidPhase = {
      key: 'invalid-phase',
      gateCriteria: ['Test criteria'],
    };

    expect(() => PhaseSchema.parse(invalidPhase)).toThrow();
  });

  it('should allow optional milestoneId', () => {
    const phaseWithMilestone = {
      key: 'concept',
      gateCriteria: ['Test criteria'],
      milestoneId: 456,
    };

    const result1 = PhaseSchema.parse(phaseWithMilestone);
    expect(result1.milestoneId).toBe(456);

    const phaseWithoutMilestone = {
      key: 'concept',
      gateCriteria: ['Test criteria'],
    };

    const result2 = PhaseSchema.parse(phaseWithoutMilestone);
    expect(result2.milestoneId).toBeUndefined();
  });

  it('should validate gate criteria array', () => {
    const phaseWithCriteria = {
      key: 'detailed',
      gateCriteria: [
        'Design complete',
        'Analysis complete',
        'Review passed',
      ],
    };

    const result = PhaseSchema.parse(phaseWithCriteria);
    expect(result.gateCriteria).toHaveLength(3);
    expect(result.gateCriteria).toContain('Design complete');
  });

  it('should validate default phases structure', () => {
    expect(DEFAULT_PHASES).toHaveLength(5);
    
    const phaseKeys = DEFAULT_PHASES.map(p => p.key);
    expect(phaseKeys).toEqual(['concept', 'prelim', 'detailed', 'critical', 'final']);
    
    DEFAULT_PHASES.forEach(phase => {
      expect(() => PhaseSchema.parse(phase)).not.toThrow();
      expect(phase.gateCriteria.length).toBeGreaterThan(0);
    });
  });

  it('should have meaningful gate criteria for each default phase', () => {
    const conceptPhase = DEFAULT_PHASES.find(p => p.key === 'concept');
    expect(conceptPhase?.gateCriteria).toContain('Requirements analysis complete');
    
    const prelimPhase = DEFAULT_PHASES.find(p => p.key === 'prelim');
    expect(prelimPhase?.gateCriteria).toContain('System architecture defined');
    
    const detailedPhase = DEFAULT_PHASES.find(p => p.key === 'detailed');
    expect(detailedPhase?.gateCriteria).toContain('Detailed design complete');
    
    const criticalPhase = DEFAULT_PHASES.find(p => p.key === 'critical');
    expect(criticalPhase?.gateCriteria).toContain('Design verification complete');
    
    const finalPhase = DEFAULT_PHASES.find(p => p.key === 'final');
    expect(finalPhase?.gateCriteria).toContain('Production documentation complete');
  });

  it('should validate phase progression logic', () => {
    const phases = ['concept', 'prelim', 'detailed', 'critical', 'final'];
    
    // Verify phases are in logical order
    DEFAULT_PHASES.forEach((phase, index) => {
      expect(phase.key).toBe(phases[index]);
    });
    
    // Each phase should have 4 gate criteria (as per default structure)
    DEFAULT_PHASES.forEach(phase => {
      expect(phase.gateCriteria).toHaveLength(4);
    });
  });
});
