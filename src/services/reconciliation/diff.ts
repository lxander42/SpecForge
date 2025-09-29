import { WbsItem } from '../../models/entities.js';
import { logger } from '../telemetry/logger.js';
import { createHash } from 'crypto';

export interface DiffResult<T> {
  added: T[];
  modified: Array<{
    before: T;
    after: T;
    changes: string[];
  }>;
  removed: T[];
  unchanged: T[];
}

export interface ReconciliationOptions {
  preserveManualEdits?: boolean;
  allowFieldUpdates?: string[];
  ignoreFields?: string[];
  customComparators?: Record<string, (a: any, b: any) => boolean>;
}

export interface ManualEdit {
  itemId: string;
  field: string;
  originalValue: any;
  manualValue: any;
  timestamp: string;
  hash: string;
}

export class ReconciliationService {
  private manualEdits: Map<string, ManualEdit[]> = new Map();

  /**
   * Compute diff between current and desired WBS items
   */
  diffWbsItems(
    current: WbsItem[],
    desired: WbsItem[],
    options: ReconciliationOptions = {}
  ): DiffResult<WbsItem> {
    logger.info('Computing WBS diff', {
      currentCount: current.length,
      desiredCount: desired.length,
    });

    const currentMap = new Map(current.map(item => [item.id, item]));
    const desiredMap = new Map(desired.map(item => [item.id, item]));

    const added: WbsItem[] = [];
    const modified: Array<{ before: WbsItem; after: WbsItem; changes: string[] }> = [];
    const removed: WbsItem[] = [];
    const unchanged: WbsItem[] = [];

    // Find added and modified items
    for (const [id, desiredItem] of desiredMap) {
      const currentItem = currentMap.get(id);
      
      if (!currentItem) {
        added.push(desiredItem);
      } else {
        const changes = this.getItemChanges(currentItem, desiredItem, options);
        if (changes.length > 0) {
          // Apply manual edit preservation
          const reconciledItem = options.preserveManualEdits 
            ? this.preserveManualEdits(currentItem, desiredItem, id)
            : desiredItem;
          
          modified.push({
            before: currentItem,
            after: reconciledItem,
            changes,
          });
        } else {
          unchanged.push(currentItem);
        }
      }
    }

    // Find removed items
    for (const [id, currentItem] of currentMap) {
      if (!desiredMap.has(id)) {
        removed.push(currentItem);
      }
    }

    const result = { added, modified, removed, unchanged };
    logger.info('WBS diff computed', {
      added: result.added.length,
      modified: result.modified.length,
      removed: result.removed.length,
      unchanged: result.unchanged.length,
    });

    return result;
  }

  /**
   * Apply diff to merge desired changes while preserving manual edits
   */
  applyDiff<T>(current: T[], diff: DiffResult<T>): T[] {
    logger.info('Applying diff to merge changes');

    const result: T[] = [];

    // Keep unchanged items
    result.push(...diff.unchanged);

    // Add new items
    result.push(...diff.added);

    // Apply modifications
    result.push(...diff.modified.map(mod => mod.after));

    // Note: removed items are intentionally not included

    logger.info(`Applied diff: ${result.length} items in final result`);
    return result;
  }

  /**
   * Record a manual edit to preserve it during reconciliation
   */
  recordManualEdit(
    itemId: string,
    field: string,
    originalValue: any,
    manualValue: any
  ): void {
    const edit: ManualEdit = {
      itemId,
      field,
      originalValue,
      manualValue,
      timestamp: new Date().toISOString(),
      hash: this.hashValue(manualValue),
    };

    const itemEdits = this.manualEdits.get(itemId) || [];
    
    // Remove any existing edit for the same field
    const filteredEdits = itemEdits.filter(e => e.field !== field);
    filteredEdits.push(edit);
    
    this.manualEdits.set(itemId, filteredEdits);
    
    logger.debug(`Recorded manual edit for ${itemId}.${field}`);
  }

  /**
   * Get all manual edits for an item
   */
  getManualEdits(itemId: string): ManualEdit[] {
    return this.manualEdits.get(itemId) || [];
  }

  /**
   * Clear manual edits for an item or field
   */
  clearManualEdits(itemId: string, field?: string): void {
    if (field) {
      const itemEdits = this.manualEdits.get(itemId) || [];
      const filteredEdits = itemEdits.filter(e => e.field !== field);
      
      if (filteredEdits.length > 0) {
        this.manualEdits.set(itemId, filteredEdits);
      } else {
        this.manualEdits.delete(itemId);
      }
      
      logger.debug(`Cleared manual edit for ${itemId}.${field}`);
    } else {
      this.manualEdits.delete(itemId);
      logger.debug(`Cleared all manual edits for ${itemId}`);
    }
  }

  /**
   * Detect if a field has been manually edited
   */
  hasManualEdit(itemId: string, field: string, currentValue: any): boolean {
    const edits = this.getManualEdits(itemId);
    const fieldEdit = edits.find(e => e.field === field);
    
    if (!fieldEdit) {
      return false;
    }

    // Check if current value matches the manual edit
    const currentHash = this.hashValue(currentValue);
    return currentHash === fieldEdit.hash;
  }

  /**
   * Create a content hash for idempotency checking
   */
  createContentHash(item: WbsItem): string {
    const hashableContent = {
      title: item.title,
      description: item.description,
      phase: item.phase,
      disciplineTags: [...item.disciplineTags].sort(),
      aiAssistable: item.aiAssistable,
      aiHint: item.aiHint,
      dependencies: [...item.dependencies].sort(),
      priority: item.priority,
    };

    return this.hashValue(hashableContent);
  }

  /**
   * Check if two WBS items are equivalent (ignoring metadata)
   */
  areItemsEquivalent(a: WbsItem, b: WbsItem): boolean {
    return this.createContentHash(a) === this.createContentHash(b);
  }

  /**
   * Merge two lists of WBS items, preserving manual edits
   */
  mergeWbsItems(
    base: WbsItem[],
    incoming: WbsItem[],
    options: ReconciliationOptions = {}
  ): WbsItem[] {
    logger.info('Merging WBS items with manual edit preservation');

    const diff = this.diffWbsItems(base, incoming, options);
    return this.applyDiff(base, diff);
  }

  /**
   * Get changes between two WBS items
   */
  private getItemChanges(
    current: WbsItem,
    desired: WbsItem,
    options: ReconciliationOptions
  ): string[] {
    const changes: string[] = [];
    const ignoreFields = new Set(options.ignoreFields || []);
    const customComparators = options.customComparators || {};

    const fieldsToCheck: Array<keyof WbsItem> = [
      'title', 'description', 'phase', 'disciplineTags', 'aiAssistable', 
      'aiHint', 'dependencies', 'priority', 'estimatedHours'
    ];

    for (const field of fieldsToCheck) {
      if (ignoreFields.has(field)) {
        continue;
      }

      const currentValue = current[field];
      const desiredValue = desired[field];

      let hasChanged: boolean;
      
      if (customComparators[field]) {
        hasChanged = !customComparators[field](currentValue, desiredValue);
      } else if (Array.isArray(currentValue) && Array.isArray(desiredValue)) {
        hasChanged = !this.arraysEqual(currentValue, desiredValue);
      } else {
        hasChanged = currentValue !== desiredValue;
      }

      if (hasChanged) {
        changes.push(field);
      }
    }

    return changes;
  }

  /**
   * Preserve manual edits when merging items
   */
  private preserveManualEdits(
    current: WbsItem,
    desired: WbsItem,
    itemId: string
  ): WbsItem {
    const result = { ...desired };
    const manualEdits = this.getManualEdits(itemId);

    for (const edit of manualEdits) {
      const field = edit.field as keyof WbsItem;
      const currentValue = current[field];

      // Check if the current value is still the manual edit
      if (this.hasManualEdit(itemId, edit.field, currentValue)) {
        // Preserve the manual edit
        (result as any)[field] = currentValue;
        logger.debug(`Preserved manual edit for ${itemId}.${edit.field}`);
      } else {
        // Manual edit has been changed, clear it
        this.clearManualEdits(itemId, edit.field);
        logger.debug(`Manual edit overridden for ${itemId}.${edit.field}`);
      }
    }

    return result;
  }

  /**
   * Check if two arrays are equal (order independent)
   */
  private arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, index) => val === sortedB[index]);
  }

  /**
   * Create a hash of any value for comparison
   */
  private hashValue(value: any): string {
    const serialized = JSON.stringify(value, Object.keys(value).sort());
    return createHash('sha256').update(serialized).digest('hex');
  }
}

// Singleton instance
let reconciliationServiceInstance: ReconciliationService | null = null;

/**
 * Get or create the reconciliation service singleton
 */
export function getReconciliationService(): ReconciliationService {
  if (!reconciliationServiceInstance) {
    reconciliationServiceInstance = new ReconciliationService();
  }
  return reconciliationServiceInstance;
}

/**
 * Reset the reconciliation service singleton (useful for testing)
 */
export function resetReconciliationService(): void {
  reconciliationServiceInstance = null;
}
