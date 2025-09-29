import { describe, it, expect } from 'vitest';
import { 
  BaselineSchema, 
  ChangeLogSchema, 
  ChangeLogEntrySchema,
  validateBaseline, 
  validateChangeLog 
} from '@src/models/entities';

describe('Baseline and ChangeLog Entities', () => {
  describe('Baseline Entity', () => {
    it('should validate a valid baseline', () => {
      const validBaseline = {
        tag: 'v1.0-reqs',
        date: '2024-01-15',
        approver: 'john.doe@company.com',
        changeLogRef: 'baselines/v1.0-reqs/CHANGELOG.md',
      };

      const result = validateBaseline(validBaseline);
      expect(result).toEqual(validBaseline);
    });

    it('should require all mandatory fields', () => {
      const invalidBaseline = {
        tag: 'v1.0-reqs',
        date: '2024-01-15',
        // Missing approver and changeLogRef
      };

      expect(() => validateBaseline(invalidBaseline)).toThrow();
    });

    it('should validate date format (YYYY-MM-DD)', () => {
      const validDates = ['2024-01-15', '2023-12-31', '2024-02-29'];
      
      validDates.forEach(date => {
        const baseline = {
          tag: 'v1.0-reqs',
          date,
          approver: 'test@company.com',
          changeLogRef: 'CHANGELOG.md',
        };
        
        expect(() => validateBaseline(baseline)).not.toThrow();
      });

      const invalidDates = ['2024/01/15', '01-15-2024', '2024-1-15', 'invalid-date'];
      
      invalidDates.forEach(date => {
        const baseline = {
          tag: 'v1.0-reqs',
          date,
          approver: 'test@company.com',
          changeLogRef: 'CHANGELOG.md',
        };
        
        expect(() => validateBaseline(baseline)).toThrow();
      });
    });

    it('should validate baseline tag formats', () => {
      const validTags = [
        'v1.0-reqs',
        'v2.1-baseline',
        'requirements-v1.0',
        'baseline-2024-01',
        'v0.1.0-requirements',
      ];

      validTags.forEach(tag => {
        const baseline = {
          tag,
          date: '2024-01-15',
          approver: 'test@company.com',
          changeLogRef: 'CHANGELOG.md',
        };

        expect(() => validateBaseline(baseline)).not.toThrow();
      });
    });

    it('should validate approver field', () => {
      const validApprovers = [
        'john.doe@company.com',
        'project-manager',
        'technical-lead',
        'Jane Smith',
      ];

      validApprovers.forEach(approver => {
        const baseline = {
          tag: 'v1.0-reqs',
          date: '2024-01-15',
          approver,
          changeLogRef: 'CHANGELOG.md',
        };

        expect(() => validateBaseline(baseline)).not.toThrow();
      });
    });

    it('should validate changeLogRef path', () => {
      const validPaths = [
        'CHANGELOG.md',
        'baselines/v1.0/CHANGELOG.md',
        'docs/changes/CHANGELOG.md',
        'requirements/CHANGELOG.md',
      ];

      validPaths.forEach(changeLogRef => {
        const baseline = {
          tag: 'v1.0-reqs',
          date: '2024-01-15',
          approver: 'test@company.com',
          changeLogRef,
        };

        expect(() => validateBaseline(baseline)).not.toThrow();
      });
    });
  });

  describe('ChangeLog Entry Entity', () => {
    it('should validate a valid change log entry', () => {
      const validEntry = {
        id: 'CHG-001',
        type: 'added',
        summary: 'Added new functional requirement FR-005',
      };

      const result = ChangeLogEntrySchema.parse(validEntry);
      expect(result).toEqual(validEntry);
    });

    it('should validate change type enum', () => {
      const validTypes = ['added', 'changed', 'removed'];
      
      validTypes.forEach(type => {
        const entry = {
          id: 'CHG-001',
          type,
          summary: 'Test change',
        };
        
        expect(() => ChangeLogEntrySchema.parse(entry)).not.toThrow();
      });

      // Test invalid type
      const invalidEntry = {
        id: 'CHG-001',
        type: 'invalid-type',
        summary: 'Test change',
      };

      expect(() => ChangeLogEntrySchema.parse(invalidEntry)).toThrow();
    });

    it('should require all fields', () => {
      const incompleteEntry = {
        id: 'CHG-001',
        // Missing type and summary
      };

      expect(() => ChangeLogEntrySchema.parse(incompleteEntry)).toThrow();
    });
  });

  describe('ChangeLog Entity', () => {
    it('should validate a valid change log', () => {
      const validChangeLog = {
        path: 'CHANGELOG.md',
        entries: [
          {
            id: 'CHG-001',
            type: 'added',
            summary: 'Added new functional requirement FR-005',
          },
          {
            id: 'CHG-002',
            type: 'changed',
            summary: 'Updated performance requirement PR-001',
          },
          {
            id: 'CHG-003',
            type: 'removed',
            summary: 'Removed obsolete requirement FR-003',
          },
        ],
      };

      const result = validateChangeLog(validChangeLog);
      expect(result).toEqual(validChangeLog);
    });

    it('should require path and entries', () => {
      const invalidChangeLog = {
        path: 'CHANGELOG.md',
        // Missing entries
      };

      expect(() => validateChangeLog(invalidChangeLog)).toThrow();
    });

    it('should validate entries array', () => {
      const changeLogWithEntries = {
        path: 'CHANGELOG.md',
        entries: [
          {
            id: 'CHG-001',
            type: 'added',
            summary: 'Added requirement',
          },
          {
            id: 'CHG-002',
            type: 'changed',
            summary: 'Modified requirement',
          },
        ],
      };

      const result = validateChangeLog(changeLogWithEntries);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].type).toBe('added');
      expect(result.entries[1].type).toBe('changed');
    });

    it('should allow empty entries array', () => {
      const emptyChangeLog = {
        path: 'CHANGELOG.md',
        entries: [],
      };

      expect(() => validateChangeLog(emptyChangeLog)).not.toThrow();
    });

    it('should validate change log path formats', () => {
      const validPaths = [
        'CHANGELOG.md',
        'baselines/v1.0/CHANGELOG.md',
        'requirements/CHANGELOG.md',
        'docs/CHANGELOG.md',
      ];

      validPaths.forEach(path => {
        const changeLog = {
          path,
          entries: [],
        };

        expect(() => validateChangeLog(changeLog)).not.toThrow();
      });
    });

    it('should validate comprehensive change log scenario', () => {
      const comprehensiveChangeLog = {
        path: 'baselines/v2.0-reqs/CHANGELOG.md',
        entries: [
          {
            id: 'CHG-001',
            type: 'added',
            summary: 'Added new safety requirement SR-010 for emergency shutdown',
          },
          {
            id: 'CHG-002',
            type: 'changed',
            summary: 'Updated performance requirement PR-003 to include load conditions',
          },
          {
            id: 'CHG-003',
            type: 'changed',
            summary: 'Modified environmental requirement ER-002 temperature range',
          },
          {
            id: 'CHG-004',
            type: 'removed',
            summary: 'Removed obsolete interface requirement IR-001',
          },
          {
            id: 'CHG-005',
            type: 'added',
            summary: 'Added verification method VM-015 for thermal testing',
          },
        ],
      };

      const result = validateChangeLog(comprehensiveChangeLog);
      expect(result.entries).toHaveLength(5);
      
      const addedEntries = result.entries.filter(e => e.type === 'added');
      const changedEntries = result.entries.filter(e => e.type === 'changed');
      const removedEntries = result.entries.filter(e => e.type === 'removed');
      
      expect(addedEntries).toHaveLength(2);
      expect(changedEntries).toHaveLength(2);
      expect(removedEntries).toHaveLength(1);
    });
  });

  describe('Baseline and ChangeLog Integration', () => {
    it('should validate baseline with corresponding change log', () => {
      const baseline = {
        tag: 'v2.0-reqs',
        date: '2024-02-01',
        approver: 'technical-lead@company.com',
        changeLogRef: 'baselines/v2.0-reqs/CHANGELOG.md',
      };

      const changeLog = {
        path: 'baselines/v2.0-reqs/CHANGELOG.md',
        entries: [
          {
            id: 'CHG-001',
            type: 'added',
            summary: 'Added new requirements for v2.0',
          },
        ],
      };

      expect(() => validateBaseline(baseline)).not.toThrow();
      expect(() => validateChangeLog(changeLog)).not.toThrow();
      
      // Verify reference consistency
      expect(baseline.changeLogRef).toBe(changeLog.path);
    });

    it('should validate schema structures', () => {
      expect(BaselineSchema.shape.tag).toBeDefined();
      expect(BaselineSchema.shape.date).toBeDefined();
      expect(BaselineSchema.shape.approver).toBeDefined();
      expect(BaselineSchema.shape.changeLogRef).toBeDefined();

      expect(ChangeLogSchema.shape.path).toBeDefined();
      expect(ChangeLogSchema.shape.entries).toBeDefined();

      expect(ChangeLogEntrySchema.shape.id).toBeDefined();
      expect(ChangeLogEntrySchema.shape.type).toBeDefined();
      expect(ChangeLogEntrySchema.shape.summary).toBeDefined();
    });
  });
});
