/**
 * Idempotency helpers for SpecForge CLI
 * Provides content hashing and upsert operations for safe re-runs
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { FileSystemError, FileWriteError, DirectoryCreateError } from './errors.js';

// Content hashing utilities
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function hashObject(obj: unknown): string {
  const normalized = JSON.stringify(obj, Object.keys(obj as object).sort());
  return hashContent(normalized);
}

export interface ContentWithHash {
  content: string;
  hash: string;
}

export function createContentWithHash(content: string): ContentWithHash {
  return {
    content,
    hash: hashContent(content),
  };
}

// File operations with hash tracking
export interface FileMetadata {
  path: string;
  hash: string;
  lastModified: Date;
  size: number;
}

export function getFileMetadata(filePath: string): FileMetadata | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    
    const content = readFileSync(filePath, 'utf-8');
    const stats = require('fs').statSync(filePath);
    
    return {
      path: filePath,
      hash: hashContent(content),
      lastModified: stats.mtime,
      size: stats.size,
    };
  } catch (error) {
    return null;
  }
}

export function hasFileChanged(filePath: string, expectedHash: string): boolean {
  const metadata = getFileMetadata(filePath);
  if (!metadata) {
    return true; // File doesn't exist, so it has "changed"
  }
  return metadata.hash !== expectedHash;
}

// Safe file writing with backup
export interface WriteOptions {
  createBackup?: boolean;
  ensureDirectory?: boolean;
  encoding?: BufferEncoding;
}

export function writeFileIdempotent(
  filePath: string,
  content: string,
  options: WriteOptions = {}
): boolean {
  const {
    createBackup = false,
    ensureDirectory = true,
    encoding = 'utf-8',
  } = options;
  
  try {
    // Check if content is already identical
    const existingMetadata = getFileMetadata(filePath);
    const newHash = hashContent(content);
    
    if (existingMetadata && existingMetadata.hash === newHash) {
      return false; // No change needed
    }
    
    // Ensure directory exists
    if (ensureDirectory) {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        try {
          mkdirSync(dir, { recursive: true });
        } catch (error) {
          throw new DirectoryCreateError(dir, (error as Error).message);
        }
      }
    }
    
    // Create backup if requested and file exists
    if (createBackup && existingMetadata) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      try {
        writeFileSync(backupPath, readFileSync(filePath));
      } catch (error) {
        throw new FileWriteError(backupPath, (error as Error).message);
      }
    }
    
    // Write new content
    try {
      writeFileSync(filePath, content, encoding);
      return true; // File was changed
    } catch (error) {
      throw new FileWriteError(filePath, (error as Error).message);
    }
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }
    throw new FileSystemError(
      `Failed to write file idempotently: ${(error as Error).message}`,
      filePath,
      'write'
    );
  }
}

// Content merging utilities
export interface MergeSection {
  start: string;
  end: string;
  content: string;
}

export function extractManagedSections(
  content: string,
  startMarker: string,
  endMarker: string
): MergeSection[] {
  const sections: MergeSection[] = [];
  const lines = content.split('\n');
  
  let currentSection: MergeSection | null = null;
  let sectionContent: string[] = [];
  
  for (const line of lines) {
    if (line.includes(startMarker)) {
      if (currentSection) {
        // Nested or malformed sections - close previous
        currentSection.content = sectionContent.join('\n');
        sections.push(currentSection);
      }
      currentSection = {
        start: startMarker,
        end: endMarker,
        content: '',
      };
      sectionContent = [];
    } else if (line.includes(endMarker) && currentSection) {
      currentSection.content = sectionContent.join('\n');
      sections.push(currentSection);
      currentSection = null;
      sectionContent = [];
    } else if (currentSection) {
      sectionContent.push(line);
    }
  }
  
  return sections;
}

export function replaceManagedSection(
  originalContent: string,
  newSectionContent: string,
  startMarker: string,
  endMarker: string
): string {
  const lines = originalContent.split('\n');
  const result: string[] = [];
  
  let insideManagedSection = false;
  let foundSection = false;
  
  for (const line of lines) {
    if (line.includes(startMarker)) {
      insideManagedSection = true;
      foundSection = true;
      result.push(line);
      result.push(newSectionContent);
    } else if (line.includes(endMarker) && insideManagedSection) {
      insideManagedSection = false;
      result.push(line);
    } else if (!insideManagedSection) {
      result.push(line);
    }
    // Skip lines inside managed section (they get replaced)
  }
  
  // If no managed section was found, append it
  if (!foundSection) {
    result.push('');
    result.push(startMarker);
    result.push(newSectionContent);
    result.push(endMarker);
  }
  
  return result.join('\n');
}

// Diff utilities for change detection
export interface DiffResult {
  hasChanges: boolean;
  added: string[];
  removed: string[];
  modified: string[];
}

export function diffLines(oldContent: string, newContent: string): DiffResult {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  
  // Simple line-by-line diff (could be enhanced with proper diff algorithm)
  const maxLines = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    
    if (oldLine === undefined) {
      added.push(newLine);
    } else if (newLine === undefined) {
      removed.push(oldLine);
    } else if (oldLine !== newLine) {
      modified.push(`-${oldLine}\n+${newLine}`);
    }
  }
  
  return {
    hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0,
    added,
    removed,
    modified,
  };
}

// Upsert operations for collections
export interface UpsertOptions<T> {
  keyExtractor: (item: T) => string;
  merger?: (existing: T, incoming: T) => T;
  validator?: (item: T) => boolean;
}

export function upsertArray<T>(
  existing: T[],
  incoming: T[],
  options: UpsertOptions<T>
): { result: T[]; changes: DiffResult } {
  const { keyExtractor, merger, validator } = options;
  
  // Create maps for efficient lookup
  const existingMap = new Map<string, T>();
  const incomingMap = new Map<string, T>();
  
  existing.forEach(item => {
    existingMap.set(keyExtractor(item), item);
  });
  
  incoming.forEach(item => {
    if (!validator || validator(item)) {
      incomingMap.set(keyExtractor(item), item);
    }
  });
  
  const result: T[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  
  // Add/update items from incoming
  incomingMap.forEach((incomingItem, key) => {
    const existingItem = existingMap.get(key);
    
    if (existingItem) {
      const finalItem = merger ? merger(existingItem, incomingItem) : incomingItem;
      result.push(finalItem);
      
      if (JSON.stringify(existingItem) !== JSON.stringify(finalItem)) {
        modified.push(key);
      }
    } else {
      result.push(incomingItem);
      added.push(key);
    }
  });
  
  // Track removed items
  existingMap.forEach((_, key) => {
    if (!incomingMap.has(key)) {
      removed.push(key);
    }
  });
  
  return {
    result,
    changes: {
      hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0,
      added,
      removed,
      modified,
    },
  };
}

// State tracking for idempotent operations
export interface OperationState {
  id: string;
  hash: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export class StateTracker {
  private states = new Map<string, OperationState>();
  
  recordOperation(
    id: string,
    content: unknown,
    metadata: Record<string, unknown> = {}
  ): void {
    this.states.set(id, {
      id,
      hash: hashObject(content),
      timestamp: new Date(),
      metadata,
    });
  }
  
  hasChanged(id: string, content: unknown): boolean {
    const state = this.states.get(id);
    if (!state) {
      return true; // No previous state, so it has "changed"
    }
    
    const currentHash = hashObject(content);
    return state.hash !== currentHash;
  }
  
  getState(id: string): OperationState | undefined {
    return this.states.get(id);
  }
  
  clearState(id: string): boolean {
    return this.states.delete(id);
  }
  
  getAllStates(): OperationState[] {
    return Array.from(this.states.values());
  }
  
  exportStates(): string {
    return JSON.stringify(Array.from(this.states.entries()), null, 2);
  }
  
  importStates(statesJson: string): void {
    try {
      const entries = JSON.parse(statesJson);
      this.states = new Map(entries);
    } catch (error) {
      throw new Error(`Failed to import states: ${(error as Error).message}`);
    }
  }
}

// Default state tracker instance
export const globalStateTracker = new StateTracker();

// Utility for checking if operation should be skipped
export function shouldSkipOperation(
  operationId: string,
  content: unknown,
  tracker: StateTracker = globalStateTracker
): boolean {
  return !tracker.hasChanged(operationId, content);
}

// Utility for recording operation completion
export function recordOperationCompletion(
  operationId: string,
  content: unknown,
  metadata: Record<string, unknown> = {},
  tracker: StateTracker = globalStateTracker
): void {
  tracker.recordOperation(operationId, content, {
    ...metadata,
    completedAt: new Date().toISOString(),
  });
}

// Content templating with hash tracking
export interface TemplateVariable {
  name: string;
  value: string;
}

export function renderTemplate(
  template: string,
  variables: TemplateVariable[]
): ContentWithHash {
  let content = template;
  
  variables.forEach(variable => {
    const placeholder = `{{${variable.name}}}`;
    content = content.replace(new RegExp(placeholder, 'g'), variable.value);
  });
  
  return createContentWithHash(content);
}

export function extractTemplateVariables(template: string): string[] {
  const matches = template.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  
  return matches.map(match => match.replace(/[{}]/g, ''));
}

// Batch operation utilities
export interface BatchOperation<T> {
  id: string;
  data: T;
  operation: (data: T) => Promise<unknown>;
}

export async function executeBatchIdempotent<T>(
  operations: BatchOperation<T>[],
  tracker: StateTracker = globalStateTracker
): Promise<{ completed: string[]; skipped: string[]; errors: Array<{ id: string; error: Error }> }> {
  const completed: string[] = [];
  const skipped: string[] = [];
  const errors: Array<{ id: string; error: Error }> = [];
  
  for (const op of operations) {
    try {
      if (shouldSkipOperation(op.id, op.data, tracker)) {
        skipped.push(op.id);
        continue;
      }
      
      await op.operation(op.data);
      recordOperationCompletion(op.id, op.data, {}, tracker);
      completed.push(op.id);
    } catch (error) {
      errors.push({ id: op.id, error: error as Error });
    }
  }
  
  return { completed, skipped, errors };
}
