/**
 * Configuration management for SpecForge CLI
 * Handles loading/saving configuration files and environment variables
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { z } from 'zod';
import { ConfigurationError, MissingConfigError, InvalidConfigError, FileSystemError } from './errors.js';
import { writeFileIdempotent } from './idempotency.js';

// Configuration schema
const ConfigSchema = z.object({
  github: z.object({
    token: z.string().optional(),
    org: z.string().optional(),
    repo: z.string().optional(),
  }).optional(),
  ai: z.object({
    provider: z.enum(['openai', 'azure-openai', 'anthropic', 'bedrock', 'local']).optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
    endpoint: z.string().url().optional(),
  }).optional(),
  project: z.object({
    disciplines: z.array(z.enum(['Mechanical', 'Electrical', 'Firmware', 'Software'])).optional(),
    complexity: z.enum(['low', 'medium', 'high']).optional(),
    constitution: z.string().optional(),
  }).optional(),
  behavior: z.object({
    dryRun: z.boolean().default(false),
    verbose: z.boolean().default(false),
    json: z.boolean().default(false),
    autoApprove: z.boolean().default(false),
  }).optional(),
  paths: z.object({
    requirements: z.string().default('requirements/'),
    baselines: z.string().default('baselines/'),
    specs: z.string().default('specs/'),
  }).optional(),
  performance: z.object({
    maxConcurrentRequests: z.number().min(1).max(20).default(5),
    retryAttempts: z.number().min(0).max(10).default(3),
    timeoutMs: z.number().min(1000).max(60000).default(30000),
    rateLimitBuffer: z.number().min(0).max(1000).default(100),
  }).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

// Default configuration
const DEFAULT_CONFIG: Config = {
  behavior: {
    dryRun: false,
    verbose: false,
    json: false,
    autoApprove: false,
  },
  paths: {
    requirements: 'requirements/',
    baselines: 'baselines/',
    specs: 'specs/',
  },
  performance: {
    maxConcurrentRequests: 5,
    retryAttempts: 3,
    timeoutMs: 30000,
    rateLimitBuffer: 100,
  },
};

// Configuration file paths
export function getConfigDir(): string {
  const configDir = join(homedir(), '.specforge');
  if (!existsSync(configDir)) {
    try {
      mkdirSync(configDir, { recursive: true });
    } catch (error) {
      throw new FileSystemError(
        `Failed to create config directory: ${(error as Error).message}`,
        configDir,
        'mkdir'
      );
    }
  }
  return configDir;
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

export function getLocalConfigPath(): string {
  return join(process.cwd(), '.specforge', 'config.json');
}

// Configuration loading
export function loadConfig(): Config {
  const globalConfigPath = getConfigPath();
  const localConfigPath = getLocalConfigPath();
  
  let config = { ...DEFAULT_CONFIG };
  
  // Load global config
  if (existsSync(globalConfigPath)) {
    try {
      const globalConfigContent = readFileSync(globalConfigPath, 'utf-8');
      const globalConfig = JSON.parse(globalConfigContent);
      config = mergeConfigs(config, globalConfig);
    } catch (error) {
      throw new InvalidConfigError(
        'global',
        `Failed to parse global config: ${(error as Error).message}`
      );
    }
  }
  
  // Load local config (overrides global)
  if (existsSync(localConfigPath)) {
    try {
      const localConfigContent = readFileSync(localConfigPath, 'utf-8');
      const localConfig = JSON.parse(localConfigContent);
      config = mergeConfigs(config, localConfig);
    } catch (error) {
      throw new InvalidConfigError(
        'local',
        `Failed to parse local config: ${(error as Error).message}`
      );
    }
  }
  
  // Load environment variables
  config = loadEnvironmentVariables(config);
  
  // Validate final configuration
  try {
    return ConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new InvalidConfigError(
        'merged',
        `Configuration validation failed: ${errorMessages.join(', ')}`
      );
    }
    throw new ConfigurationError(`Configuration validation failed: ${(error as Error).message}`);
  }
}

// Environment variable mapping
function loadEnvironmentVariables(config: Config): Config {
  const envConfig = { ...config };
  
  // GitHub configuration
  if (process.env.GITHUB_TOKEN) {
    envConfig.github = envConfig.github || {};
    envConfig.github.token = process.env.GITHUB_TOKEN;
  }
  
  if (process.env.GITHUB_ORG) {
    envConfig.github = envConfig.github || {};
    envConfig.github.org = process.env.GITHUB_ORG;
  }
  
  if (process.env.GITHUB_REPO) {
    envConfig.github = envConfig.github || {};
    envConfig.github.repo = process.env.GITHUB_REPO;
  }
  
  // AI configuration
  if (process.env.AI_PROVIDER) {
    envConfig.ai = envConfig.ai || {};
    envConfig.ai.provider = process.env.AI_PROVIDER as any;
  }
  
  if (process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    envConfig.ai = envConfig.ai || {};
    envConfig.ai.apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  }
  
  if (process.env.AI_MODEL) {
    envConfig.ai = envConfig.ai || {};
    envConfig.ai.model = process.env.AI_MODEL;
  }
  
  if (process.env.AI_ENDPOINT) {
    envConfig.ai = envConfig.ai || {};
    envConfig.ai.endpoint = process.env.AI_ENDPOINT;
  }
  
  // Behavior configuration
  if (process.env.SPECFORGE_DRY_RUN === 'true') {
    envConfig.behavior = envConfig.behavior || {};
    envConfig.behavior.dryRun = true;
  }
  
  if (process.env.SPECFORGE_VERBOSE === 'true') {
    envConfig.behavior = envConfig.behavior || {};
    envConfig.behavior.verbose = true;
  }
  
  if (process.env.SPECFORGE_JSON === 'true') {
    envConfig.behavior = envConfig.behavior || {};
    envConfig.behavior.json = true;
  }
  
  return envConfig;
}

// Configuration merging
function mergeConfigs(base: Config, override: Partial<Config>): Config {
  return {
    github: { ...base.github, ...override.github },
    ai: { ...base.ai, ...override.ai },
    project: { ...base.project, ...override.project },
    behavior: { ...base.behavior, ...override.behavior },
    paths: { ...base.paths, ...override.paths },
    performance: { ...base.performance, ...override.performance },
  };
}

// Configuration saving
export function saveConfig(config: Config, isGlobal = false): void {
  const configPath = isGlobal ? getConfigPath() : getLocalConfigPath();
  const configDir = dirname(configPath);
  
  // Ensure directory exists
  if (!existsSync(configDir)) {
    try {
      mkdirSync(configDir, { recursive: true });
    } catch (error) {
      throw new FileSystemError(
        `Failed to create config directory: ${(error as Error).message}`,
        configDir,
        'mkdir'
      );
    }
  }
  
  try {
    const configJson = JSON.stringify(config, null, 2);
    writeFileIdempotent(configPath, configJson, { ensureDirectory: true });
  } catch (error) {
    throw new FileSystemError(
      `Failed to save configuration: ${(error as Error).message}`,
      configPath,
      'write'
    );
  }
}

// Configuration validation helpers
export function validateGitHubConfig(config: Config): void {
  if (!config.github?.token) {
    throw new MissingConfigError('github.token', {
      hint: 'Set GITHUB_TOKEN environment variable or configure via CLI',
    });
  }
  
  if (!config.github?.org) {
    throw new MissingConfigError('github.org', {
      hint: 'Specify --org flag or set GITHUB_ORG environment variable',
    });
  }
  
  if (!config.github?.repo) {
    throw new MissingConfigError('github.repo', {
      hint: 'Specify --repo flag or set GITHUB_REPO environment variable',
    });
  }
}

export function validateAIConfig(config: Config): void {
  if (config.ai?.provider && !config.ai?.apiKey) {
    throw new MissingConfigError('ai.apiKey', {
      provider: config.ai.provider,
      hint: `Set AI_API_KEY environment variable for ${config.ai.provider}`,
    });
  }
}

export function validateProjectConfig(config: Config): void {
  if (config.project?.disciplines && config.project.disciplines.length === 0) {
    throw new InvalidConfigError('project.disciplines', 'At least one discipline is required');
  }
}

// Configuration utilities
export function getRequiredConfig<T>(
  config: Config,
  path: string,
  defaultValue?: T
): T {
  const keys = path.split('.');
  let value: any = config;
  
  for (const key of keys) {
    value = value?.[key];
  }
  
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new MissingConfigError(path);
  }
  
  return value as T;
}

export function hasConfig(config: Config, path: string): boolean {
  try {
    getRequiredConfig(config, path);
    return true;
  } catch (error) {
    return false;
  }
}

export function getGitHubToken(config: Config): string {
  return getRequiredConfig(config, 'github.token');
}

export function getGitHubOrg(config: Config): string {
  return getRequiredConfig(config, 'github.org');
}

export function getGitHubRepo(config: Config): string {
  return getRequiredConfig(config, 'github.repo');
}

export function getAIProvider(config: Config): string | undefined {
  try {
    return getRequiredConfig(config, 'ai.provider');
  } catch {
    return undefined;
  }
}

export function getAIApiKey(config: Config): string | undefined {
  try {
    return getRequiredConfig(config, 'ai.apiKey');
  } catch {
    return undefined;
  }
}

export function isDryRun(config: Config): boolean {
  return getRequiredConfig(config, 'behavior.dryRun', false);
}

export function isVerbose(config: Config): boolean {
  return getRequiredConfig(config, 'behavior.verbose', false);
}

export function isJsonOutput(config: Config): boolean {
  return getRequiredConfig(config, 'behavior.json', false);
}

// Configuration initialization
export function initializeConfig(): Config {
  try {
    return loadConfig();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      // Return default config if configuration is missing or invalid
      console.warn(`Configuration warning: ${error.message}. Using defaults.`);
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

// Export commonly used config instance
let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = initializeConfig();
  }
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}

// Configuration commands helpers
export function setConfigValue(path: string, value: unknown, isGlobal = false): void {
  const config = loadConfig();
  const keys = path.split('.');
  
  let target: any = config;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!target[key]) {
      target[key] = {};
    }
    target = target[key];
  }
  
  target[keys[keys.length - 1]] = value;
  saveConfig(config, isGlobal);
  resetConfigCache();
}

export function getConfigValue(path: string): unknown {
  const config = getConfig();
  return getRequiredConfig(config, path);
}

export function listConfig(): Record<string, unknown> {
  const config = getConfig();
  
  // Remove sensitive information
  const safeConfig = { ...config };
  if (safeConfig.github?.token) {
    safeConfig.github.token = '***';
  }
  if (safeConfig.ai?.apiKey) {
    safeConfig.ai.apiKey = '***';
  }
  
  return safeConfig;
}
