import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  sessionId?: string;
  requestId?: string;
}

// Metrics entry interface
export interface MetricsEntry {
  timestamp: string;
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  sessionId?: string;
}

// Logger configuration
export interface LoggerConfig {
  level?: LogLevel;
  outputs?: LogOutput[];
  sessionId?: string;
  enableMetrics?: boolean;
  logDirectory?: string;
  maxLogFiles?: number;
  maxLogSizeBytes?: number;
}

// Log output interface
export interface LogOutput {
  type: 'console' | 'file' | 'memory';
  level?: LogLevel;
  format?: 'json' | 'text';
  filePath?: string;
}

// In-memory log storage for testing
interface MemoryLogStorage {
  logs: LogEntry[];
  metrics: MetricsEntry[];
}

export class Logger {
  private config: LoggerConfig;
  private sessionId: string;
  private memoryStorage: MemoryLogStorage = { logs: [], metrics: [] };
  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: 'info',
      outputs: [{ type: 'console', format: 'text' }],
      enableMetrics: true,
      logDirectory: '.specforge/logs',
      maxLogFiles: 10,
      maxLogSizeBytes: 10 * 1024 * 1024, // 10MB
      ...config,
    };
    
    this.sessionId = config.sessionId || this.generateSessionId();
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    const errorContext = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined;

    this.log('error', message, context, errorContext);
  }

  /**
   * Record a metric value
   */
  metric(name: string, value: number, unit?: string, tags?: Record<string, string>): void {
    if (!this.config.enableMetrics) {
      return;
    }

    const entry: MetricsEntry = {
      timestamp: new Date().toISOString(),
      name,
      value,
      unit,
      tags,
      sessionId: this.sessionId,
    };

    this.recordMetric(entry);
  }

  /**
   * Record timing metric
   */
  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.metric(name, durationMs, 'ms', tags);
  }

  /**
   * Record counter metric
   */
  counter(name: string, increment: number = 1, tags?: Record<string, string>): void {
    this.metric(name, increment, 'count', tags);
  }

  /**
   * Record gauge metric
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.metric(name, value, 'gauge', tags);
  }

  /**
   * Create a timer function for measuring execution time
   */
  timer(name: string, tags?: Record<string, string>): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.timing(name, duration, tags);
    };
  }

  /**
   * Wrap an async function with timing metrics
   */
  async timeAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const stopTimer = this.timer(name, tags);
    try {
      const result = await fn();
      stopTimer();
      return result;
    } catch (error) {
      stopTimer();
      this.error(`Timed operation '${name}' failed`, { name, tags }, error as Error);
      throw error;
    }
  }

  /**
   * Get logs from memory storage (for testing)
   */
  getMemoryLogs(): LogEntry[] {
    return [...this.memoryStorage.logs];
  }

  /**
   * Get metrics from memory storage (for testing)
   */
  getMemoryMetrics(): MetricsEntry[] {
    return [...this.memoryStorage.metrics];
  }

  /**
   * Clear memory storage
   */
  clearMemory(): void {
    this.memoryStorage.logs = [];
    this.memoryStorage.metrics = [];
  }

  /**
   * Flush all pending logs to outputs
   */
  async flush(): Promise<void> {
    // For file outputs, ensure all writes are completed
    // This is a no-op for the current implementation but could be extended
    // for buffered logging
  }

  /**
   * Close the logger and clean up resources
   */
  async close(): Promise<void> {
    await this.flush();
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: { name: string; message: string; stack?: string }
  ): void {
    // Check if log level is enabled
    if (this.logLevels[level] < this.logLevels[this.config.level!]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      sessionId: this.sessionId,
    };

    this.writeToOutputs(entry);
  }

  /**
   * Write log entry to all configured outputs
   */
  private writeToOutputs(entry: LogEntry): void {
    for (const output of this.config.outputs!) {
      // Check output-specific level filtering
      if (output.level && this.logLevels[entry.level] < this.logLevels[output.level]) {
        continue;
      }

      switch (output.type) {
        case 'console':
          this.writeToConsole(entry, output);
          break;
        case 'file':
          this.writeToFile(entry, output);
          break;
        case 'memory':
          this.writeToMemory(entry);
          break;
      }
    }
  }

  /**
   * Write to console output
   */
  private writeToConsole(entry: LogEntry, output: LogOutput): void {
    const formatted = this.formatEntry(entry, output.format || 'text');
    
    switch (entry.level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'debug':
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  /**
   * Write to file output
   */
  private writeToFile(entry: LogEntry, output: LogOutput): void {
    if (!output.filePath) {
      return;
    }

    const formatted = this.formatEntry(entry, output.format || 'json') + '\n';
    
    // Asynchronous file write (fire and forget)
    this.ensureLogDirectory()
      .then(() => fs.appendFile(output.filePath!, formatted))
      .catch(error => {
        console.error('Failed to write log to file:', error);
      });
  }

  /**
   * Write to memory storage
   */
  private writeToMemory(entry: LogEntry): void {
    this.memoryStorage.logs.push(entry);
    
    // Limit memory storage size
    if (this.memoryStorage.logs.length > 1000) {
      this.memoryStorage.logs = this.memoryStorage.logs.slice(-500);
    }
  }

  /**
   * Record metric to outputs
   */
  private recordMetric(entry: MetricsEntry): void {
    // Store in memory for retrieval
    this.memoryStorage.metrics.push(entry);
    
    // Limit memory storage size
    if (this.memoryStorage.metrics.length > 1000) {
      this.memoryStorage.metrics = this.memoryStorage.metrics.slice(-500);
    }

    // Could extend to write metrics to file or external systems
    this.debug('Metric recorded', {
      name: entry.name,
      value: entry.value,
      unit: entry.unit,
      tags: entry.tags,
    });
  }

  /**
   * Format log entry for output
   */
  private formatEntry(entry: LogEntry, format: 'json' | 'text'): string {
    if (format === 'json') {
      return JSON.stringify(entry);
    }

    // Text format
    const timestamp = entry.timestamp.substring(0, 19).replace('T', ' ');
    const level = entry.level.toUpperCase().padEnd(5);
    const sessionShort = entry.sessionId?.substring(0, 8) || 'unknown';
    
    let formatted = `${timestamp} [${level}] [${sessionShort}] ${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      formatted += ` ${JSON.stringify(entry.context)}`;
    }
    
    if (entry.error) {
      formatted += `\nError: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        formatted += `\n${entry.error.stack}`;
      }
    }
    
    return formatted;
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    if (this.config.logDirectory) {
      await fs.mkdir(this.config.logDirectory, { recursive: true });
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return createHash('sha256')
      .update(timestamp + random)
      .digest('hex')
      .substring(0, 16);
  }
}

// Default logger instance
let defaultLogger: Logger | null = null;

/**
 * Get or create the default logger instance
 */
export function getLogger(config?: LoggerConfig): Logger {
  if (!defaultLogger || config) {
    defaultLogger = new Logger(config);
  }
  return defaultLogger;
}

/**
 * Reset the default logger (useful for testing)
 */
export function resetLogger(): void {
  defaultLogger = null;
}

/**
 * Configure the default logger
 */
export function configureLogger(config: LoggerConfig): Logger {
  defaultLogger = new Logger(config);
  return defaultLogger;
}

// Export default logger instance for convenience
export const logger = getLogger();

// Convenience functions using default logger
export const debug = (message: string, context?: Record<string, unknown>) => 
  logger.debug(message, context);

export const info = (message: string, context?: Record<string, unknown>) => 
  logger.info(message, context);

export const warn = (message: string, context?: Record<string, unknown>) => 
  logger.warn(message, context);

export const error = (message: string, context?: Record<string, unknown>, err?: Error) => 
  logger.error(message, context, err);

export const metric = (name: string, value: number, unit?: string, tags?: Record<string, string>) => 
  logger.metric(name, value, unit, tags);

export const timing = (name: string, durationMs: number, tags?: Record<string, string>) => 
  logger.timing(name, durationMs, tags);

export const counter = (name: string, increment?: number, tags?: Record<string, string>) => 
  logger.counter(name, increment, tags);

export const gauge = (name: string, value: number, tags?: Record<string, string>) => 
  logger.gauge(name, value, tags);

export const timer = (name: string, tags?: Record<string, string>) => 
  logger.timer(name, tags);

export const timeAsync = <T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>) => 
  logger.timeAsync(name, fn, tags);
