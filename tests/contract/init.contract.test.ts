import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// Load the JSON schema
const schemaPath = join(process.cwd(), 'specs', '001-hardware-project-cli-ai-integration', 'contracts', 'init.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

// Create Zod schema based on JSON schema
const InitCommandSchema = z.object({
  org: z.string(),
  repo: z.string(),
  disciplines: z.array(z.enum(['Mechanical', 'Electrical', 'Firmware', 'Software'])),
  complexity: z.enum(['low', 'medium', 'high']),
  aiProvider: z.string().optional(),
  dryRun: z.boolean().optional(),
  json: z.boolean().optional(),
}).strict(); // additionalProperties: false

describe('Init Contract Test', () => {
  it('should validate required fields', () => {
    const validInput = {
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['Mechanical', 'Electrical'],
      complexity: 'medium' as const,
    };

    expect(() => InitCommandSchema.parse(validInput)).not.toThrow();
  });

  it('should reject missing required fields', () => {
    const invalidInput = {
      org: 'test-org',
      // missing repo, disciplines, complexity
    };

    expect(() => InitCommandSchema.parse(invalidInput)).toThrow();
  });

  it('should validate discipline enum constraints', () => {
    const validInput = {
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['Mechanical', 'Electrical', 'Firmware', 'Software'],
      complexity: 'high' as const,
    };

    expect(() => InitCommandSchema.parse(validInput)).not.toThrow();

    const invalidInput = {
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['InvalidDiscipline'],
      complexity: 'high' as const,
    };

    expect(() => InitCommandSchema.parse(invalidInput)).toThrow();
  });

  it('should validate complexity enum constraints', () => {
    const validInput = {
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['Mechanical'],
      complexity: 'low' as const,
    };

    expect(() => InitCommandSchema.parse(validInput)).not.toThrow();

    const invalidInput = {
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['Mechanical'],
      complexity: 'invalid' as any,
    };

    expect(() => InitCommandSchema.parse(invalidInput)).toThrow();
  });

  it('should reject additional properties', () => {
    const invalidInput = {
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['Mechanical'],
      complexity: 'medium' as const,
      extraProperty: 'should-not-be-allowed',
    };

    expect(() => InitCommandSchema.parse(invalidInput)).toThrow();
  });

  it('should allow optional fields', () => {
    const validInput = {
      org: 'test-org',
      repo: 'test-repo',
      disciplines: ['Mechanical', 'Software'],
      complexity: 'high' as const,
      aiProvider: 'openai',
      dryRun: true,
      json: true,
    };

    expect(() => InitCommandSchema.parse(validInput)).not.toThrow();
  });

  it('should validate schema structure matches JSON schema', () => {
    expect(schema.title).toBe('InitCommand');
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['org', 'repo', 'disciplines', 'complexity']);
    
    // Validate disciplines enum values
    expect(schema.properties.disciplines.items.enum).toEqual(['Mechanical', 'Electrical', 'Firmware', 'Software']);
    
    // Validate complexity enum values
    expect(schema.properties.complexity.enum).toEqual(['low', 'medium', 'high']);
  });
});
