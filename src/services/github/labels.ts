import { getGitHubClient } from './client.js';
import { GitHubError } from '../../lib/errors.js';
import { logger } from '../telemetry/logger.js';

export interface Label {
  id?: number;
  name: string;
  color: string;
  description?: string;
  url?: string;
}

export interface CreateLabelOptions {
  name: string;
  color: string;
  description?: string;
}

export interface UpdateLabelOptions {
  name?: string;
  color?: string;
  description?: string;
}

export class GitHubLabelsService {
  private client = getGitHubClient();

  /**
   * Get all labels for a repository
   */
  async getLabels(owner: string, repo: string): Promise<Label[]> {
    try {
      const response = await this.client.executeRest(() =>
        this.client.octokit.issues.listLabelsForRepo({
          owner,
          repo,
          per_page: 100,
        })
      );

      logger.debug(`Found ${response.data.length} labels in ${owner}/${repo}`);
      return response.data.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description || undefined,
        url: label.url,
      }));
    } catch (error) {
      throw new GitHubError(`Failed to get labels for repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
      });
    }
  }

  /**
   * Get a specific label by name
   */
  async getLabel(owner: string, repo: string, name: string): Promise<Label | null> {
    try {
      const response = await this.client.executeRest(() =>
        this.client.octokit.issues.getLabel({
          owner,
          repo,
          name,
        })
      );

      return {
        id: response.data.id,
        name: response.data.name,
        color: response.data.color,
        description: response.data.description || undefined,
        url: response.data.url,
      };
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw new GitHubError(`Failed to get label '${name}' from repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        name,
      });
    }
  }

  /**
   * Create a new label
   */
  async createLabel(owner: string, repo: string, options: CreateLabelOptions): Promise<Label> {
    try {
      const response = await this.client.executeRest(() =>
        this.client.octokit.issues.createLabel({
          owner,
          repo,
          name: options.name,
          color: options.color,
          description: options.description,
        })
      );

      const label = {
        id: response.data.id,
        name: response.data.name,
        color: response.data.color,
        description: response.data.description || undefined,
        url: response.data.url,
      };

      logger.info(`Created label '${label.name}' in ${owner}/${repo}`);
      return label;
    } catch (error) {
      throw new GitHubError(`Failed to create label '${options.name}' in repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        name: options.name,
      });
    }
  }

  /**
   * Update an existing label
   */
  async updateLabel(
    owner: string,
    repo: string,
    currentName: string,
    options: UpdateLabelOptions
  ): Promise<Label> {
    try {
      const response = await this.client.executeRest(() =>
        this.client.octokit.issues.updateLabel({
          owner,
          repo,
          name: currentName,
          new_name: options.name,
          color: options.color,
          description: options.description,
        })
      );

      const label = {
        id: response.data.id,
        name: response.data.name,
        color: response.data.color,
        description: response.data.description || undefined,
        url: response.data.url,
      };

      logger.info(`Updated label '${currentName}' -> '${label.name}' in ${owner}/${repo}`);
      return label;
    } catch (error) {
      throw new GitHubError(`Failed to update label '${currentName}' in repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        name: currentName,
      });
    }
  }

  /**
   * Delete a label
   */
  async deleteLabel(owner: string, repo: string, name: string): Promise<void> {
    try {
      await this.client.executeRest(() =>
        this.client.octokit.issues.deleteLabel({
          owner,
          repo,
          name,
        })
      );

      logger.info(`Deleted label '${name}' from ${owner}/${repo}`);
    } catch (error) {
      throw new GitHubError(`Failed to delete label '${name}' from repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        name,
      });
    }
  }

  /**
   * Ensure a label exists, creating or updating it as necessary
   */
  async ensureLabel(owner: string, repo: string, options: CreateLabelOptions): Promise<Label> {
    const existingLabel = await this.getLabel(owner, repo, options.name);
    
    if (existingLabel) {
      // Check if update is needed
      if (
        existingLabel.color !== options.color ||
        existingLabel.description !== options.description
      ) {
        logger.debug(`Updating label '${options.name}' in ${owner}/${repo}`);
        return await this.updateLabel(owner, repo, options.name, {
          color: options.color,
          description: options.description,
        });
      }
      
      logger.debug(`Label '${options.name}' already exists and is up to date in ${owner}/${repo}`);
      return existingLabel;
    }

    logger.info(`Creating label '${options.name}' in ${owner}/${repo}`);
    return await this.createLabel(owner, repo, options);
  }

  /**
   * Ensure multiple labels exist
   */
  async ensureLabels(owner: string, repo: string, labels: CreateLabelOptions[]): Promise<Label[]> {
    const results: Label[] = [];
    
    // Process labels in batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < labels.length; i += batchSize) {
      const batch = labels.slice(i, i + batchSize);
      const batchPromises = batch.map(label => this.ensureLabel(owner, repo, label));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to be gentle on rate limits
      if (i + batchSize < labels.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info(`Ensured ${results.length} labels in ${owner}/${repo}`);
    return results;
  }

  /**
   * Get standard SpecForge labels for hardware projects
   */
  getStandardLabels(): CreateLabelOptions[] {
    return [
      // Phase labels
      { name: 'phase:concept', color: 'E8F5E8', description: 'Concept phase tasks' },
      { name: 'phase:prelim', color: 'FFF2CC', description: 'Preliminary design phase tasks' },
      { name: 'phase:detailed', color: 'FFE6CC', description: 'Detailed design phase tasks' },
      { name: 'phase:critical', color: 'FFCCCC', description: 'Critical design review phase tasks' },
      { name: 'phase:final', color: 'E6CCFF', description: 'Final phase tasks' },

      // Discipline labels
      { name: 'discipline:mechanical', color: '0052CC', description: 'Mechanical engineering tasks' },
      { name: 'discipline:electrical', color: 'FF6B35', description: 'Electrical engineering tasks' },
      { name: 'discipline:firmware', color: '36B37E', description: 'Firmware development tasks' },
      { name: 'discipline:software', color: '6554C0', description: 'Software development tasks' },

      // Complexity labels
      { name: 'complexity:low', color: '57D9A3', description: 'Low complexity tasks' },
      { name: 'complexity:medium', color: 'FFAB00', description: 'Medium complexity tasks' },
      { name: 'complexity:high', color: 'FF5630', description: 'High complexity tasks' },

      // AI assistance labels
      { name: 'ai-assistable', color: '7B68EE', description: 'Task can be assisted by AI' },
      { name: 'human-only', color: 'FF8C42', description: 'Task requires human expertise only' },

      // Status labels
      { name: 'status:blocked', color: 'DE350B', description: 'Task is blocked' },
      { name: 'status:in-review', color: 'FFC400', description: 'Task is under review' },
      { name: 'status:approved', color: '00875A', description: 'Task has been approved' },

      // Priority labels
      { name: 'priority:critical', color: 'FF5630', description: 'Critical priority' },
      { name: 'priority:high', color: 'FF8B00', description: 'High priority' },
      { name: 'priority:medium', color: 'FFAB00', description: 'Medium priority' },
      { name: 'priority:low', color: '36B37E', description: 'Low priority' },
    ];
  }
}

// Singleton instance
let labelsServiceInstance: GitHubLabelsService | null = null;

/**
 * Get or create the GitHub labels service singleton
 */
export function getGitHubLabelsService(): GitHubLabelsService {
  if (!labelsServiceInstance) {
    labelsServiceInstance = new GitHubLabelsService();
  }
  return labelsServiceInstance;
}

/**
 * Reset the labels service singleton (useful for testing)
 */
export function resetGitHubLabelsService(): void {
  labelsServiceInstance = null;
}
