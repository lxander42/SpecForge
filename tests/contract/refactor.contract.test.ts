import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// Load the JSON schema
const schemaPath = join(process.cwd(), 'specs', '001-hardware-project-cli-ai-integration', 'contracts', 'refactor.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

// Create Zod schema based on JSON schema
const RefactorCommandSchema = z.object({
  org: z.string(),
  repo: z.string(),
  reconcile: z.boolean().optional(),
  prune: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  json: z.boolean().optional(),
}).strict(); // additionalProperties: false

describe('Refactor Contract Test', () => {
  it('should validate required fields', () => {
    const validInput = {
      org: 'test-org',
      repo: 'test-repo',
    };

    expect(() => RefactorCommandSchema.parse(validInput)).not.toThrow();
  });

  it('should reject missing required fields', () => {
    const invalidInputMissingOrg = {
      repo: 'test-repo',
    };

    expect(() => RefactorCommandSchema.parse(invalidInputMissingOrg)).toThrow();

    const invalidInputMissingRepo = {
      org: 'test-org',
    };

    expect(() => RefactorCommandSchema.parse(invalidInputMissingRepo)).toThrow();
  });

  it('should allow all optional flags', () => {
    const validInput = {
      org: 'test-org',
      repo: 'test-repo',
      reconcile: true,
      prune: false,
      dryRun: true,
      json: true,
    };

    expect(() => RefactorCommandSchema.parse(validInput)).not.toThrow();
  });

  it('should validate boolean types for flags', () => {
    const invalidInput = {
      org: 'test-org',
      repo: 'test-repo',
      reconcile: 'true', // should be boolean, not string
    };

    expect(() => RefactorCommandSchema.parse(invalidInput)).toThrow();
  });

  it('should reject additional properties', () => {
    const invalidInput = {
      org: 'test-org',
      repo: 'test-repo',
      extraProperty: 'should-not-be-allowed',
    };

    expect(() => RefactorCommandSchema.parse(invalidInput)).toThrow();
  });

  it('should validate schema structure matches JSON schema', () => {
    expect(schema.title).toBe('RefactorCommand');
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['org', 'repo']);
    
    // Validate all properties are defined
    expect(schema.properties).toHaveProperty('org');
    expect(schema.properties).toHaveProperty('repo');
    expect(schema.properties).toHaveProperty('reconcile');
    expect(schema.properties).toHaveProperty('prune');
    expect(schema.properties).toHaveProperty('dryRun');
    expect(schema.properties).toHaveProperty('json');
    
    // Validate boolean properties
    expect(schema.properties.reconcile.type).toBe('boolean');
    expect(schema.properties.prune.type).toBe('boolean');
    expect(schema.properties.dryRun.type).toBe('boolean');
    expect(schema.properties.json.type).toBe('boolean');
  });

  it('should work with minimal input', () => {
    const minimalInput = {
      org: 'my-org',
      repo: 'my-hardware-project',
    };

    const result = RefactorCommandSchema.parse(minimalInput);
    expect(result.org).toBe('my-org');
    expect(result.repo).toBe('my-hardware-project');
    expect(result.reconcile).toBeUndefined();
    expect(result.prune).toBeUndefined();
    expect(result.dryRun).toBeUndefined();
    expect(result.json).toBeUndefined();
  });
});
