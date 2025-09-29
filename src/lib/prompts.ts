/**
 * Interactive prompts for SpecForge CLI
 * Provides inquirer-based user input with validation
 */

import inquirer from 'inquirer';
import { z } from 'zod';
import { DisciplineEnum, ComplexityEnum } from '../models/entities.js';
import { UserInputError, ValidationError } from './errors.js';

// Prompt types
export interface PromptOptions {
  message: string;
  default?: unknown;
  required?: boolean;
  validate?: (input: unknown) => boolean | string;
}

export interface SelectOptions extends PromptOptions {
  choices: Array<string | { name: string; value: string; description?: string }>;
  multiple?: boolean;
}

export interface ConfirmOptions extends PromptOptions {
  default?: boolean;
}

// Project initialization prompts
export async function promptGitHubDetails(): Promise<{
  org: string;
  repo: string;
}> {
  const questions = [
    {
      type: 'input',
      name: 'org',
      message: 'GitHub organization:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Organization is required';
        }
        if (!/^[a-zA-Z0-9-]+$/.test(input)) {
          return 'Organization must contain only alphanumeric characters and hyphens';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'repo',
      message: 'GitHub repository:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Repository is required';
        }
        if (!/^[a-zA-Z0-9-_.]+$/.test(input)) {
          return 'Repository must contain only alphanumeric characters, hyphens, underscores, and dots';
        }
        return true;
      },
    },
  ];

  try {
    return await inquirer.prompt(questions);
  } catch (error) {
    throw new UserInputError(`Failed to get GitHub details: ${(error as Error).message}`);
  }
}

export async function promptProjectDetails(): Promise<{
  disciplines: string[];
  complexity: string;
}> {
  const questions = [
    {
      type: 'checkbox',
      name: 'disciplines',
      message: 'Select project disciplines:',
      choices: [
        {
          name: 'Mechanical Engineering',
          value: 'Mechanical',
          description: 'Mechanical design, materials, manufacturing',
        },
        {
          name: 'Electrical Engineering',
          value: 'Electrical',
          description: 'Circuit design, power systems, electronics',
        },
        {
          name: 'Firmware Development',
          value: 'Firmware',
          description: 'Embedded software, device drivers, real-time systems',
        },
        {
          name: 'Software Development',
          value: 'Software',
          description: 'Applications, web interfaces, automation tools',
        },
      ],
      validate: (input: string[]) => {
        if (input.length === 0) {
          return 'At least one discipline must be selected';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'complexity',
      message: 'Project complexity level:',
      choices: [
        {
          name: 'Low - Simple project with minimal dependencies',
          value: 'low',
          description: 'Single discipline focus, well-defined requirements',
        },
        {
          name: 'Medium - Moderate complexity with some integration',
          value: 'medium',
          description: 'Multi-discipline project, moderate risk',
        },
        {
          name: 'High - Complex project with significant integration',
          value: 'high',
          description: 'All disciplines involved, high risk, regulatory requirements',
        },
      ],
      default: 'medium',
    },
  ];

  try {
    const answers = await inquirer.prompt(questions);
    
    // Validate disciplines
    try {
      answers.disciplines.forEach((discipline: string) => {
        DisciplineEnum.parse(discipline);
      });
    } catch {
      throw new ValidationError('Invalid discipline selection');
    }
    
    // Validate complexity
    try {
      ComplexityEnum.parse(answers.complexity);
    } catch {
      throw new ValidationError('Invalid complexity selection');
    }
    
    return answers;
  } catch (error) {
    throw new UserInputError(`Failed to get project details: ${(error as Error).message}`);
  }
}

export async function promptAIConfiguration(): Promise<{
  useAI: boolean;
  provider?: string;
  apiKey?: string;
}> {
  const useAIQuestion = {
    type: 'confirm',
    name: 'useAI',
    message: 'Enable AI assistance for documentation and checklist tasks?',
    default: false,
  };

  try {
    const { useAI } = await inquirer.prompt([useAIQuestion]);
    
    if (!useAI) {
      return { useAI: false };
    }

    const aiQuestions = [
      {
        type: 'list',
        name: 'provider',
        message: 'Select AI provider:',
        choices: [
          {
            name: 'OpenAI (GPT-4, GPT-3.5)',
            value: 'openai',
            description: 'Requires OPENAI_API_KEY',
          },
          {
            name: 'Anthropic (Claude)',
            value: 'anthropic',
            description: 'Requires ANTHROPIC_API_KEY',
          },
          {
            name: 'Azure OpenAI',
            value: 'azure-openai',
            description: 'Requires Azure endpoint and API key',
          },
          {
            name: 'AWS Bedrock',
            value: 'bedrock',
            description: 'Requires AWS credentials',
          },
          {
            name: 'Local/Self-hosted',
            value: 'local',
            description: 'Local model endpoint',
          },
        ],
        default: 'openai',
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'API Key (or press Enter to use environment variable):',
        mask: '*',
        when: (answers: any) => answers.provider !== 'local',
      },
    ];

    const aiAnswers = await inquirer.prompt(aiQuestions);
    return { useAI: true, ...aiAnswers };
  } catch (error) {
    throw new UserInputError(`Failed to get AI configuration: ${(error as Error).message}`);
  }
}

// Confirmation prompts
export async function confirmAction(
  message: string,
  defaultValue = false
): Promise<boolean> {
  try {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: defaultValue,
      },
    ]);
    return confirmed;
  } catch (error) {
    throw new UserInputError(`Failed to get confirmation: ${(error as Error).message}`);
  }
}

export async function confirmDangerousAction(message: string): Promise<boolean> {
  try {
    const { typeConfirm } = await inquirer.prompt([
      {
        type: 'input',
        name: 'typeConfirm',
        message: `${message}\\nType 'yes' to confirm:`,
        validate: (input: string) => {
          if (input.toLowerCase() !== 'yes') {
            return 'You must type "yes" to confirm this action';
          }
          return true;
        },
      },
    ]);
    return typeConfirm.toLowerCase() === 'yes';
  } catch (error) {
    throw new UserInputError(`Failed to get dangerous action confirmation: ${(error as Error).message}`);
  }
}

// Requirements management prompts
export async function promptRequirementDetails(): Promise<{
  id: string;
  section: string;
  text: string;
  acceptanceCriteria: string;
  verificationMethod: string;
}> {
  const questions = [
    {
      type: 'input',
      name: 'id',
      message: 'Requirement ID (e.g., FR-001):',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Requirement ID is required';
        }
        if (!/^[A-Z]{1,3}-\d{3}$/.test(input)) {
          return 'ID must follow format: XX-001 (e.g., FR-001, PR-002)';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'section',
      message: 'Requirement section:',
      choices: [
        { name: 'Functional Requirements', value: 'functional' },
        { name: 'Performance Requirements', value: 'performance' },
        { name: 'Environmental Requirements', value: 'environmental' },
        { name: 'Interface Requirements', value: 'interfaces' },
        { name: 'Safety Requirements', value: 'safety' },
        { name: 'Verification Methods', value: 'verification' },
        { name: 'Acceptance Criteria', value: 'acceptance' },
      ],
    },
    {
      type: 'editor',
      name: 'text',
      message: 'Requirement text:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Requirement text is required';
        }
        if (input.length < 10) {
          return 'Requirement text must be at least 10 characters';
        }
        return true;
      },
    },
    {
      type: 'editor',
      name: 'acceptanceCriteria',
      message: 'Acceptance criteria:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Acceptance criteria is required';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'verificationMethod',
      message: 'Verification method:',
      choices: [
        { name: 'Test - Verification by testing', value: 'Test' },
        { name: 'Inspection - Visual or physical inspection', value: 'Inspection' },
        { name: 'Analysis - Mathematical or simulation analysis', value: 'Analysis' },
        { name: 'Demonstration - Functional demonstration', value: 'Demonstration' },
      ],
    },
  ];

  try {
    return await inquirer.prompt(questions);
  } catch (error) {
    throw new UserInputError(`Failed to get requirement details: ${(error as Error).message}`);
  }
}

// Baseline management prompts
export async function promptBaselineDetails(): Promise<{
  tag: string;
  approver: string;
}> {
  const questions = [
    {
      type: 'input',
      name: 'tag',
      message: 'Baseline tag (e.g., v1.0-reqs):',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Baseline tag is required';
        }
        if (!/^v\d+\.\d+/.test(input)) {
          return 'Tag should start with version number (e.g., v1.0-reqs)';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'approver',
      message: 'Approver name or email:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Approver is required';
        }
        return true;
      },
    },
  ];

  try {
    return await inquirer.prompt(questions);
  } catch (error) {
    throw new UserInputError(`Failed to get baseline details: ${(error as Error).message}`);
  }
}

// Generic input prompts
export async function promptInput(
  message: string,
  options: Partial<PromptOptions> = {}
): Promise<string> {
  try {
    const { input } = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message,
        default: options.default,
        validate: options.validate || ((input: string) => {
          if (options.required !== false && !input.trim()) {
            return 'Input is required';
          }
          return true;
        }),
      },
    ]);
    return input;
  } catch (error) {
    throw new UserInputError(`Failed to get input: ${(error as Error).message}`);
  }
}

export async function promptSelect(
  message: string,
  choices: string[] | Array<{ name: string; value: string }>,
  options: Partial<SelectOptions> = {}
): Promise<string | string[]> {
  try {
    const promptType = options.multiple ? 'checkbox' : 'list';
    const { selection } = await inquirer.prompt([
      {
        type: promptType,
        name: 'selection',
        message,
        choices,
        default: options.default,
        validate: options.validate,
      },
    ]);
    return selection;
  } catch (error) {
    throw new UserInputError(`Failed to get selection: ${(error as Error).message}`);
  }
}

// Progress and status prompts
export async function promptContinue(message = 'Continue?'): Promise<boolean> {
  return await confirmAction(message, true);
}

export async function promptRetry(
  operation: string,
  error: string
): Promise<boolean> {
  return await confirmAction(
    `Operation '${operation}' failed: ${error}\\nWould you like to retry?`,
    true
  );
}

// Validation helpers
export function validateEmail(input: string): boolean | string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input)) {
    return 'Please enter a valid email address';
  }
  return true;
}

export function validateUrl(input: string): boolean | string {
  try {
    new URL(input);
    return true;
  } catch {
    return 'Please enter a valid URL';
  }
}

export function validateRequired(input: string): boolean | string {
  if (!input.trim()) {
    return 'This field is required';
  }
  return true;
}

export function validateMinLength(minLength: number) {
  return (input: string): boolean | string => {
    if (input.length < minLength) {
      return `Input must be at least ${minLength} characters long`;
    }
    return true;
  };
}

export function validateMaxLength(maxLength: number) {
  return (input: string): boolean | string => {
    if (input.length > maxLength) {
      return `Input must be no more than ${maxLength} characters long`;
    }
    return true;
  };
}

// Batch prompts for efficiency
export async function promptBatch<T>(
  prompts: Array<{
    name: keyof T;
    type: string;
    message: string;
    choices?: any[];
    default?: any;
    validate?: (input: any) => boolean | string;
  }>
): Promise<T> {
  try {
    return await inquirer.prompt(prompts as any);
  } catch (error) {
    throw new UserInputError(`Failed to get batch input: ${(error as Error).message}`);
  }
}
