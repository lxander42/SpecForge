/**
 * Typed error hierarchy for SpecForge CLI
 * Provides structured error handling with context and error codes
 */

export abstract class SpecForgeError extends Error {
  abstract readonly code: string;
  abstract readonly category: string;
  
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      context: this.context,
      stack: this.stack,
    };
  }
}

// Configuration and setup errors
export abstract class ConfigurationError extends SpecForgeError {
  readonly category = 'configuration';
}

export class MissingConfigError extends ConfigurationError {
  readonly code = 'MISSING_CONFIG';
  
  constructor(configKey: string, context?: Record<string, unknown>) {
    super(`Missing required configuration: ${configKey}`, context);
  }
}

export class InvalidConfigError extends ConfigurationError {
  readonly code = 'INVALID_CONFIG';
  
  constructor(configKey: string, reason: string, context?: Record<string, unknown>) {
    super(`Invalid configuration for ${configKey}: ${reason}`, context);
  }
}

// GitHub API errors
export abstract class GitHubError extends SpecForgeError {
  readonly category = 'github';
  
  constructor(
    message: string,
    public readonly statusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, statusCode });
  }
}

export class GitHubAuthError extends GitHubError {
  readonly code = 'GITHUB_AUTH_ERROR';
  
  constructor(context?: Record<string, unknown>) {
    super('GitHub authentication failed. Check your GITHUB_TOKEN.', undefined, context);
  }
}

export class GitHubRateLimitError extends GitHubError {
  readonly code = 'GITHUB_RATE_LIMIT';
  
  constructor(resetTime?: Date, context?: Record<string, unknown>) {
    const message = resetTime 
      ? `GitHub rate limit exceeded. Resets at ${resetTime.toISOString()}`
      : 'GitHub rate limit exceeded';
    super(message, 403, { ...context, resetTime });
  }
}

export class GitHubNotFoundError extends GitHubError {
  readonly code = 'GITHUB_NOT_FOUND';
  
  constructor(resource: string, context?: Record<string, unknown>) {
    super(`GitHub resource not found: ${resource}`, 404, context);
  }
}

export class GitHubPermissionError extends GitHubError {
  readonly code = 'GITHUB_PERMISSION';
  
  constructor(action: string, resource: string, context?: Record<string, unknown>) {
    super(`Insufficient permissions to ${action} ${resource}`, 403, context);
  }
}

// Validation errors
export abstract class ValidationError extends SpecForgeError {
  readonly category = 'validation';
  
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, field, value });
  }
}

export class SchemaValidationError extends ValidationError {
  readonly code = 'SCHEMA_VALIDATION';
  
  constructor(
    schemaName: string,
    errors: Array<{ path: string; message: string }>,
    context?: Record<string, unknown>
  ) {
    const errorSummary = errors.map(e => `${e.path}: ${e.message}`).join('; ');
    super(`Schema validation failed for ${schemaName}: ${errorSummary}`, undefined, undefined, {
      ...context,
      schemaName,
      validationErrors: errors,
    });
  }
}

// File system and I/O errors
export abstract class FileSystemError extends SpecForgeError {
  readonly category = 'filesystem';
  
  constructor(
    message: string,
    public readonly path?: string,
    public readonly operation?: string,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, path, operation });
  }
}

export class FileNotFoundError extends FileSystemError {
  readonly code = 'FILE_NOT_FOUND';
  
  constructor(path: string, context?: Record<string, unknown>) {
    super(`File not found: ${path}`, path, 'read', context);
  }
}

export class FileWriteError extends FileSystemError {
  readonly code = 'FILE_WRITE_ERROR';
  
  constructor(path: string, reason?: string, context?: Record<string, unknown>) {
    const message = reason 
      ? `Failed to write file ${path}: ${reason}`
      : `Failed to write file: ${path}`;
    super(message, path, 'write', context);
  }
}

export class DirectoryCreateError extends FileSystemError {
  readonly code = 'DIRECTORY_CREATE_ERROR';
  
  constructor(path: string, reason?: string, context?: Record<string, unknown>) {
    const message = reason
      ? `Failed to create directory ${path}: ${reason}`
      : `Failed to create directory: ${path}`;
    super(message, path, 'mkdir', context);
  }
}

// Business logic errors
export abstract class BusinessLogicError extends SpecForgeError {
  readonly category = 'business';
}

export class RequirementError extends BusinessLogicError {
  readonly code = 'REQUIREMENT_ERROR';
  
  constructor(
    requirementId: string,
    issue: string,
    context?: Record<string, unknown>
  ) {
    super(`Requirement ${requirementId}: ${issue}`, { ...context, requirementId, issue });
  }
}

export class WbsError extends BusinessLogicError {
  readonly code = 'WBS_ERROR';
  
  constructor(
    wbsId: string,
    issue: string,
    context?: Record<string, unknown>
  ) {
    super(`WBS item ${wbsId}: ${issue}`, { ...context, wbsId, issue });
  }
}

export class PhaseGateError extends BusinessLogicError {
  readonly code = 'PHASE_GATE_ERROR';
  
  constructor(
    phase: string,
    missingCriteria: string[],
    context?: Record<string, unknown>
  ) {
    super(
      `Phase gate ${phase} cannot be passed. Missing criteria: ${missingCriteria.join(', ')}`,
      { ...context, phase, missingCriteria }
    );
  }
}

// AI and automation errors
export abstract class AIError extends SpecForgeError {
  readonly category = 'ai';
}

export class AIProviderError extends AIError {
  readonly code = 'AI_PROVIDER_ERROR';
  
  constructor(
    provider: string,
    issue: string,
    context?: Record<string, unknown>
  ) {
    super(`AI provider ${provider}: ${issue}`, { ...context, provider, issue });
  }
}

export class AIPolicyViolationError extends AIError {
  readonly code = 'AI_POLICY_VIOLATION';
  
  constructor(
    task: string,
    reason: string,
    context?: Record<string, unknown>
  ) {
    super(`AI assistance not allowed for task '${task}': ${reason}`, { ...context, task, reason });
  }
}

// Network and external service errors
export abstract class NetworkError extends SpecForgeError {
  readonly category = 'network';
  
  constructor(
    message: string,
    public readonly url?: string,
    public readonly statusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, url, statusCode });
  }
}

export class TimeoutError extends NetworkError {
  readonly code = 'TIMEOUT_ERROR';
  
  constructor(operation: string, timeoutMs: number, context?: Record<string, unknown>) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`, undefined, undefined, {
      ...context,
      operation,
      timeoutMs,
    });
  }
}

export class RetryExhaustedError extends NetworkError {
  readonly code = 'RETRY_EXHAUSTED';
  
  constructor(
    operation: string,
    attempts: number,
    lastError: Error,
    context?: Record<string, unknown>
  ) {
    super(
      `Operation '${operation}' failed after ${attempts} attempts. Last error: ${lastError.message}`,
      undefined,
      undefined,
      { ...context, operation, attempts, lastError: lastError.message }
    );
  }
}

// User input and command errors
export class UserInputError extends SpecForgeError {
  readonly code = 'USER_INPUT_ERROR';
  readonly category = 'user';
  
  constructor(
    message: string,
    public readonly inputField?: string,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, inputField });
  }
}

export class CommandExecutionError extends SpecForgeError {
  readonly code = 'COMMAND_EXECUTION_ERROR';
  readonly category = 'command';
  
  constructor(
    command: string,
    exitCode: number,
    stderr?: string,
    context?: Record<string, unknown>
  ) {
    super(
      `Command '${command}' failed with exit code ${exitCode}${stderr ? `: ${stderr}` : ''}`,
      { ...context, command, exitCode, stderr }
    );
  }
}

// Error handling utilities
export function isSpecForgeError(error: unknown): error is SpecForgeError {
  return error instanceof SpecForgeError;
}

export function getErrorCode(error: unknown): string {
  if (isSpecForgeError(error)) {
    return error.code;
  }
  if (error instanceof Error) {
    return 'UNKNOWN_ERROR';
  }
  return 'NON_ERROR_THROWN';
}

export function getErrorCategory(error: unknown): string {
  if (isSpecForgeError(error)) {
    return error.category;
  }
  return 'unknown';
}

export function formatError(error: unknown): string {
  if (isSpecForgeError(error)) {
    const context = error.context ? ` (${JSON.stringify(error.context)})` : '';
    return `[${error.code}] ${error.message}${context}`;
  }
  if (error instanceof Error) {
    return `[UNKNOWN_ERROR] ${error.message}`;
  }
  return `[NON_ERROR_THROWN] ${String(error)}`;
}

export function createErrorWithContext(
  ErrorClass: new (...args: any[]) => SpecForgeError,
  args: any[],
  context: Record<string, unknown>
): SpecForgeError {
  const error = new ErrorClass(...args);
  // Create new instance with merged context since context is readonly
  return new ErrorClass(...args, { ...error.context, ...context });
}

// Error aggregation for batch operations
export class AggregateError extends SpecForgeError {
  readonly code = 'AGGREGATE_ERROR';
  readonly category = 'aggregate';
  
  constructor(
    public readonly errors: SpecForgeError[],
    operation?: string,
    context?: Record<string, unknown>
  ) {
    const message = operation
      ? `Multiple errors occurred during ${operation} (${errors.length} errors)`
      : `Multiple errors occurred (${errors.length} errors)`;
    
    super(message, {
      ...context,
      operation,
      errorCount: errors.length,
      errorCodes: errors.map(e => e.code),
    });
  }
  
  getErrorsByCategory(): Record<string, SpecForgeError[]> {
    return this.errors.reduce((acc, error) => {
      const category = error.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(error);
      return acc;
    }, {} as Record<string, SpecForgeError[]>);
  }
  
  hasErrorsOfType(ErrorClass: new (...args: any[]) => SpecForgeError): boolean {
    return this.errors.some(error => error instanceof ErrorClass);
  }
}
