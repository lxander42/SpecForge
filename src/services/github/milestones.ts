import { getGitHubClient } from './client.js';
import { GitHubError } from '../../lib/errors.js';
import { logger } from '../telemetry/logger.js';

export interface Milestone {
  id: number;
  number: number;
  title: string;
  description?: string;
  state: 'open' | 'closed';
  dueOn?: string;
  openIssues: number;
  closedIssues: number;
  url: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface CreateMilestoneOptions {
  title: string;
  description?: string;
  dueOn?: string;
  state?: 'open' | 'closed';
}

export interface UpdateMilestoneOptions {
  title?: string;
  description?: string;
  dueOn?: string | null;
  state?: 'open' | 'closed';
}

export interface MilestoneSearchOptions {
  state?: 'open' | 'closed' | 'all';
  sort?: 'due_on' | 'completeness';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export class GitHubMilestonesService {
  private client = getGitHubClient();

  /**
   * Get all milestones for a repository
   */
  async getMilestones(owner: string, repo: string, options: MilestoneSearchOptions = {}): Promise<Milestone[]> {
    try {
      const response = await this.client.executeRest(() =>
        this.client.octokit.issues.listMilestones({
          owner,
          repo,
          state: options.state || 'all',
          sort: options.sort || 'due_on',
          direction: options.direction || 'asc',
          per_page: options.per_page || 100,
          page: options.page || 1,
        })
      );

      logger.debug(`Found ${response.data.length} milestones in ${owner}/${repo}`);
      return response.data.map(this.mapMilestone);
    } catch (error) {
      throw new GitHubError(`Failed to get milestones for repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
      });
    }
  }

  /**
   * Get a specific milestone by number
   */
  async getMilestone(owner: string, repo: string, milestoneNumber: number): Promise<Milestone | null> {
    try {
      const response = await this.client.executeRest(() =>
        this.client.octokit.issues.getMilestone({
          owner,
          repo,
          milestone_number: milestoneNumber,
        })
      );

      return this.mapMilestone(response.data);
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw new GitHubError(`Failed to get milestone #${milestoneNumber} from repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        milestoneNumber,
      });
    }
  }

  /**
   * Find a milestone by title
   */
  async findMilestoneByTitle(owner: string, repo: string, title: string): Promise<Milestone | null> {
    try {
      const milestones = await this.getMilestones(owner, repo, { 
        state: 'all',
        per_page: 100,
      });

      return milestones.find(milestone => milestone.title === title) || null;
    } catch (error) {
      logger.warn(`Failed to search for milestone with title '${title}' in ${owner}/${repo}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Create a new milestone
   */
  async createMilestone(owner: string, repo: string, options: CreateMilestoneOptions): Promise<Milestone> {
    try {
      const response = await this.client.executeRest(() =>
        this.client.octokit.issues.createMilestone({
          owner,
          repo,
          title: options.title,
          description: options.description,
          due_on: options.dueOn,
          state: options.state || 'open',
        })
      );

      const milestone = this.mapMilestone(response.data);
      logger.info(`Created milestone #${milestone.number}: '${milestone.title}' in ${owner}/${repo}`);
      return milestone;
    } catch (error) {
      throw new GitHubError(`Failed to create milestone '${options.title}' in repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        title: options.title,
      });
    }
  }

  /**
   * Update an existing milestone
   */
  async updateMilestone(
    owner: string,
    repo: string,
    milestoneNumber: number,
    options: UpdateMilestoneOptions
  ): Promise<Milestone> {
    try {
      const response = await this.client.executeRest(() =>
        this.client.octokit.issues.updateMilestone({
          owner,
          repo,
          milestone_number: milestoneNumber,
          title: options.title,
          description: options.description,
          due_on: options.dueOn,
          state: options.state,
        })
      );

      const milestone = this.mapMilestone(response.data);
      logger.info(`Updated milestone #${milestone.number}: '${milestone.title}' in ${owner}/${repo}`);
      return milestone;
    } catch (error) {
      throw new GitHubError(`Failed to update milestone #${milestoneNumber} in repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        milestoneNumber,
      });
    }
  }

  /**
   * Delete a milestone
   */
  async deleteMilestone(owner: string, repo: string, milestoneNumber: number): Promise<void> {
    try {
      await this.client.executeRest(() =>
        this.client.octokit.issues.deleteMilestone({
          owner,
          repo,
          milestone_number: milestoneNumber,
        })
      );

      logger.info(`Deleted milestone #${milestoneNumber} from ${owner}/${repo}`);
    } catch (error) {
      throw new GitHubError(`Failed to delete milestone #${milestoneNumber} from repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        milestoneNumber,
      });
    }
  }

  /**
   * Close a milestone
   */
  async closeMilestone(owner: string, repo: string, milestoneNumber: number): Promise<Milestone> {
    return this.updateMilestone(owner, repo, milestoneNumber, { state: 'closed' });
  }

  /**
   * Reopen a milestone
   */
  async reopenMilestone(owner: string, repo: string, milestoneNumber: number): Promise<Milestone> {
    return this.updateMilestone(owner, repo, milestoneNumber, { state: 'open' });
  }

  /**
   * Ensure a milestone exists, creating or updating it as necessary
   */
  async ensureMilestone(owner: string, repo: string, title: string, options: CreateMilestoneOptions): Promise<Milestone> {
    const existingMilestone = await this.findMilestoneByTitle(owner, repo, title);
    
    if (existingMilestone) {
      // Check if update is needed
      const needsUpdate = 
        existingMilestone.description !== options.description ||
        existingMilestone.dueOn !== options.dueOn ||
        existingMilestone.state !== (options.state || 'open');

      if (needsUpdate) {
        logger.debug(`Updating milestone '${title}' in ${owner}/${repo}`);
        return await this.updateMilestone(owner, repo, existingMilestone.number, {
          description: options.description,
          dueOn: options.dueOn,
          state: options.state,
        });
      }
      
      logger.debug(`Milestone '${title}' already exists and is up to date in ${owner}/${repo}`);
      return existingMilestone;
    }

    logger.info(`Creating milestone '${title}' in ${owner}/${repo}`);
    return await this.createMilestone(owner, repo, { ...options, title });
  }

  /**
   * Create multiple milestones in batches
   */
  async createMilestones(owner: string, repo: string, milestones: CreateMilestoneOptions[]): Promise<Milestone[]> {
    const results: Milestone[] = [];
    
    // Process milestones in batches to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < milestones.length; i += batchSize) {
      const batch = milestones.slice(i, i + batchSize);
      const batchPromises = batch.map(milestone => this.createMilestone(owner, repo, milestone));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to be gentle on rate limits
      if (i + batchSize < milestones.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    logger.info(`Created ${results.length} milestones in ${owner}/${repo}`);
    return results;
  }

  /**
   * Get standard SpecForge milestones for hardware projects
   */
  getStandardMilestones(): CreateMilestoneOptions[] {
    return [
      {
        title: 'Phase 0: Concept',
        description: 'Initial concept development and feasibility analysis',
        state: 'open',
      },
      {
        title: 'Phase 1: Preliminary Design',
        description: 'Preliminary design and requirements definition',
        state: 'open',
      },
      {
        title: 'Phase 2: Detailed Design',
        description: 'Detailed design and component specification',
        state: 'open',
      },
      {
        title: 'Phase 3: Critical Design Review',
        description: 'Critical design review and validation',
        state: 'open',
      },
      {
        title: 'Phase 4: Final',
        description: 'Final implementation and delivery',
        state: 'open',
      },
    ];
  }

  /**
   * Map GitHub API milestone response to our Milestone interface
   */
  private mapMilestone(apiMilestone: any): Milestone {
    return {
      id: apiMilestone.id,
      number: apiMilestone.number,
      title: apiMilestone.title,
      description: apiMilestone.description || undefined,
      state: apiMilestone.state,
      dueOn: apiMilestone.due_on || undefined,
      openIssues: apiMilestone.open_issues,
      closedIssues: apiMilestone.closed_issues,
      url: apiMilestone.url,
      htmlUrl: apiMilestone.html_url,
      createdAt: apiMilestone.created_at,
      updatedAt: apiMilestone.updated_at,
      closedAt: apiMilestone.closed_at || undefined,
    };
  }
}

// Singleton instance
let milestonesServiceInstance: GitHubMilestonesService | null = null;

/**
 * Get or create the GitHub milestones service singleton
 */
export function getGitHubMilestonesService(): GitHubMilestonesService {
  if (!milestonesServiceInstance) {
    milestonesServiceInstance = new GitHubMilestonesService();
  }
  return milestonesServiceInstance;
}

/**
 * Reset the milestones service singleton (useful for testing)
 */
export function resetGitHubMilestonesService(): void {
  milestonesServiceInstance = null;
}
