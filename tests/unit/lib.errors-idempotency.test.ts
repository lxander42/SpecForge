import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  SpecForgeError,
  ConfigurationError,
  MissingConfigError,
  GitHubError,
  ValidationError,
  isSpecForgeError,
  getErrorCode,
  formatError,
} from '@src/lib/errors';
import {
  hashContent,
  hashObject,
  createContentWithHash,
  writeFileIdempotent,
  hasFileChanged,
  StateTracker,
  shouldSkipOperation,
  recordOperationCompletion,
} from '@src/lib/idempotency';

describe('Errors Module', () => {
  describe('SpecForgeError hierarchy', () => {
    it('should create base SpecForgeError with context', () => {
      const context = { key: 'value', number: 42 };
      const error = new ConfigurationError('Test error', context);
      
      expect(error).toBeInstanceOf(SpecForgeError);
      expect(error.message).toBe('Test error');
      expect(error.context).toEqual(context);
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.category).toBe('configuration');
    });

    it('should create MissingConfigError with proper structure', () => {
      const error = new MissingConfigError('github.token');
      
      expect(error.code).toBe('MISSING_CONFIG');
      expect(error.category).toBe('configuration');
      expect(error.message).toContain('github.token');
    });

    it('should create GitHubError with status code', () => {
      const error = new GitHubError('API failed', 404, { resource: 'repo' });
      
      expect(error.category).toBe('github');
      expect(error.statusCode).toBe(404);
      expect(error.context).toEqual({ resource: 'repo', statusCode: 404 });
    });

    it('should serialize errors to JSON', () => {
      const error = new ValidationError('Invalid input', 'email', 'not-an-email');
      const json = error.toJSON();
      
      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('category');
      expect(json).toHaveProperty('context');
      expect(json.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Error utilities', () => {
    it('should identify SpecForge errors', () => {
      const specForgeError = new ConfigurationError('test');
      const regularError = new Error('test');
      
      expect(isSpecForgeError(specForgeError)).toBe(true);
      expect(isSpecForgeError(regularError)).toBe(false);
    });

    it('should extract error codes', () => {
      const specForgeError = new MissingConfigError('test');
      const regularError = new Error('test');
      const nonError = 'not an error';
      
      expect(getErrorCode(specForgeError)).toBe('MISSING_CONFIG');
      expect(getErrorCode(regularError)).toBe('UNKNOWN_ERROR');
      expect(getErrorCode(nonError)).toBe('NON_ERROR_THROWN');
    });

    it('should format errors consistently', () => {
      const specForgeError = new ValidationError('Invalid', 'field', 'value');
      const regularError = new Error('Regular error');
      
      const formatted1 = formatError(specForgeError);
      const formatted2 = formatError(regularError);
      
      expect(formatted1).toContain('[VALIDATION_ERROR]');
      expect(formatted1).toContain('Invalid');
      expect(formatted2).toContain('[UNKNOWN_ERROR]');
      expect(formatted2).toContain('Regular error');
    });
  });
});

describe('Idempotency Module', () => {
  const testDir = join(process.cwd(), 'temp-test-idempotency');

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Content hashing', () => {
    it('should generate consistent hashes for same content', () => {
      const content = 'test content';
      const hash1 = hashContent(content);
      const hash2 = hashContent(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate different hashes for different content', () => {
      const content1 = 'test content 1';
      const content2 = 'test content 2';
      
      const hash1 = hashContent(content1);
      const hash2 = hashContent(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should hash objects consistently', () => {
      const obj1 = { b: 2, a: 1 };
      const obj2 = { a: 1, b: 2 };
      
      const hash1 = hashObject(obj1);
      const hash2 = hashObject(obj2);
      
      expect(hash1).toBe(hash2); // Should normalize key order
    });

    it('should create content with hash', () => {
      const content = 'test content';
      const contentWithHash = createContentWithHash(content);
      
      expect(contentWithHash.content).toBe(content);
      expect(contentWithHash.hash).toBe(hashContent(content));
    });
  });

  describe('File operations', () => {
    it('should write file idempotently', () => {
      const filePath = join(testDir, 'test.txt');
      const content = 'test content';
      
      // First write should return true (file changed)
      const changed1 = writeFileIdempotent(filePath, content);
      expect(changed1).toBe(true);
      expect(existsSync(filePath)).toBe(true);
      
      // Second write with same content should return false (no change)
      const changed2 = writeFileIdempotent(filePath, content);
      expect(changed2).toBe(false);
      
      // Third write with different content should return true (file changed)
      const changed3 = writeFileIdempotent(filePath, 'different content');
      expect(changed3).toBe(true);
    });

    it('should detect file changes', () => {
      const filePath = join(testDir, 'test.txt');
      const content = 'test content';
      const expectedHash = hashContent(content);
      
      // File doesn't exist yet
      expect(hasFileChanged(filePath, expectedHash)).toBe(true);
      
      // Write file
      writeFileSync(filePath, content);
      expect(hasFileChanged(filePath, expectedHash)).toBe(false);
      
      // Modify file
      writeFileSync(filePath, 'modified content');
      expect(hasFileChanged(filePath, expectedHash)).toBe(true);
    });

    it('should create directories when needed', () => {
      const deepPath = join(testDir, 'deep', 'nested', 'path', 'file.txt');
      const content = 'test content';
      
      writeFileIdempotent(deepPath, content, { ensureDirectory: true });
      expect(existsSync(deepPath)).toBe(true);
    });
  });

  describe('State tracking', () => {
    it('should track operation state', () => {
      const tracker = new StateTracker();
      const operationId = 'test-operation';
      const content = { data: 'test' };
      
      // Initially no state
      expect(tracker.hasChanged(operationId, content)).toBe(true);
      
      // Record operation
      tracker.recordOperation(operationId, content, { extra: 'metadata' });
      expect(tracker.hasChanged(operationId, content)).toBe(false);
      
      // Change content
      const newContent = { data: 'changed' };
      expect(tracker.hasChanged(operationId, newContent)).toBe(true);
      
      // Get state
      const state = tracker.getState(operationId);
      expect(state).toBeDefined();
      expect(state?.id).toBe(operationId);
      expect(state?.metadata).toEqual({ extra: 'metadata' });
    });

    it('should export and import states', () => {
      const tracker1 = new StateTracker();
      const tracker2 = new StateTracker();
      
      tracker1.recordOperation('op1', { data: 1 });
      tracker1.recordOperation('op2', { data: 2 });
      
      const exported = tracker1.exportStates();
      tracker2.importStates(exported);
      
      expect(tracker2.hasChanged('op1', { data: 1 })).toBe(false);
      expect(tracker2.hasChanged('op2', { data: 2 })).toBe(false);
      expect(tracker2.hasChanged('op3', { data: 3 })).toBe(true);
    });
  });

  describe('Utility functions', () => {
    it('should provide skip operation utility', () => {
      const tracker = new StateTracker();
      const operationId = 'test-op';
      const content = { test: 'data' };
      
      expect(shouldSkipOperation(operationId, content, tracker)).toBe(false);
      
      recordOperationCompletion(operationId, content, {}, tracker);
      expect(shouldSkipOperation(operationId, content, tracker)).toBe(true);
    });

    it('should record operation completion with metadata', () => {
      const tracker = new StateTracker();
      const operationId = 'test-op';
      const content = { test: 'data' };
      const metadata = { user: 'test-user' };
      
      recordOperationCompletion(operationId, content, metadata, tracker);
      
      const state = tracker.getState(operationId);
      expect(state?.metadata).toEqual({
        ...metadata,
        completedAt: expect.any(String),
      });
    });
  });

  describe('Content merging', () => {
    it('should extract managed sections', async () => {
      const content = `
Line 1
<!-- START_MANAGED -->
Managed content line 1
Managed content line 2
<!-- END_MANAGED -->
Line 2
`;
      
      const { extractManagedSections } = await import('@src/lib/idempotency');
      const sections = extractManagedSections(
        content,
        '<!-- START_MANAGED -->',
        '<!-- END_MANAGED -->'
      );
      
      expect(sections).toHaveLength(1);
      expect(sections[0].content).toContain('Managed content line 1');
    });

    it('should replace managed sections', async () => {
      const originalContent = `
Line 1
<!-- START_MANAGED -->
Old content
<!-- END_MANAGED -->
Line 2
`;
      
      const { replaceManagedSection } = await import('@src/lib/idempotency');
      const newContent = replaceManagedSection(
        originalContent,
        'New content',
        '<!-- START_MANAGED -->',
        '<!-- END_MANAGED -->'
      );
      
      expect(newContent).toContain('New content');
      expect(newContent).not.toContain('Old content');
      expect(newContent).toContain('Line 1');
      expect(newContent).toContain('Line 2');
    });
  });
});
