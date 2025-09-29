import { getGitHubClient } from './client.js';
import { GitHubError } from '../../lib/errors.js';
import { logger } from '../telemetry/logger.js';

export interface Issue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description?: string;
  }>;
  assignees: Array<{
    id: number;
    login: string;
  }>;
  milestone?: {
    id: number;
    number: number;
    title: string;
  };
  url: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface CreateIssueOptions {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

export interface UpdateIssueOptions {
  title?: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number | null;
  state?: 'open' | 'closed';
}

export interface IssueSearchOptions {
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  assignee?: string;
  milestone?: string | number;
  since?: string;
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export class GitHubIssuesService {
  private client = getGitHubClient();

  /**
   * Get all issues for a repository
   */
  async getIssues(owner: string, repo: string, options: IssueSearchOptions = {}): Promise<Issue[]> {
    try {
      const response = await this.client.executeRest(() =>
        this.client.octokit.issues.listForRepo({
          owner,
          repo,
          state: options.state || 'all',
          labels: options.labels?.join(','),
          assignee: options.assignee,
          milestone: options.milestone?.toString(),
          since: options.since,
          sort: options.sort || 'created',
          direction: options.direction || 'desc',
          per_page: options.per_page || 100,
          page: options.page || 1,
        })
      );

      // Filter out pull requests (GitHub API includes them in issues)
      const issues = response.data.filter(item => !item.pull_request);

      logger.debug(`Found ${issues.length} issues in ${owner}/${repo}`);
      return issues.map(this.mapIssue);
    } catch (error) {
      throw new GitHubError(`Failed to get issues for repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
      });
    }
  }

  /**
   * Get a specific issue by number
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<Issue | null> {
    try {
      const response = await this.client.executeRest(() =>
        this.client.octokit.issues.get({
          owner,
          repo,
          issue_number: issueNumber,
        })
      );

      // Check if it's actually a pull request
      if (response.data.pull_request) {
        return null;
      }

      return this.mapIssue(response.data);
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw new GitHubError(`Failed to get issue #${issueNumber} from repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        issueNumber,
      });
    }
  }

  /**
   * Find an issue by title
   */
  async findIssueByTitle(owner: string, repo: string, title: string): Promise<Issue | null> {
    try {
      // Search for issues with the specific title
      const issues = await this.getIssues(owner, repo, { 
        state: 'all',
        per_page: 100,
      });

      return issues.find(issue => issue.title === title) || null;
    } catch (error) {
      logger.warn(`Failed to search for issue with title '${title}' in ${owner}/${repo}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Create a new issue
   */
  async createIssue(owner: string, repo: string, options: CreateIssueOptions): Promise<Issue> {
    try {
      const response = await this.client.executeRest(() =>
        this.client.octokit.issues.create({
          owner,
          repo,
          title: options.title,
          body: options.body,
          labels: options.labels,
          assignees: options.assignees,
          milestone: options.milestone,
        })
      );

      const issue = this.mapIssue(response.data);
      logger.info(`Created issue #${issue.number}: '${issue.title}' in ${owner}/${repo}`);
      return issue;
    } catch (error) {
      throw new GitHubError(`Failed to create issue '${options.title}' in repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        title: options.title,
      });
    }
  }

  /**
   * Update an existing issue
   */
  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    options: UpdateIssueOptions
  ): Promise<Issue> {
    try {
      const response = await this.client.executeRest(() =>
        this.client.octokit.issues.update({
          owner,
          repo,
          issue_number: issueNumber,
          title: options.title,
          body: options.body,
          labels: options.labels,
          assignees: options.assignees,
          milestone: options.milestone,
          state: options.state,
        })
      );

      const issue = this.mapIssue(response.data);
      logger.info(`Updated issue #${issue.number}: '${issue.title}' in ${owner}/${repo}`);
      return issue;
    } catch (error) {
      throw new GitHubError(`Failed to update issue #${issueNumber} in repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        issueNumber,
      });
    }
  }

  /**
   * Close an issue
   */
  async closeIssue(owner: string, repo: string, issueNumber: number): Promise<Issue> {
    return this.updateIssue(owner, repo, issueNumber, { state: 'closed' });
  }

  /**
   * Reopen an issue
   */
  async reopenIssue(owner: string, repo: string, issueNumber: number): Promise<Issue> {
    return this.updateIssue(owner, repo, issueNumber, { state: 'open' });
  }

  /**
   * Add labels to an issue
   */
  async addLabelsToIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[]
  ): Promise<void> {
    try {
      await this.client.executeRest(() =>
        this.client.octokit.issues.addLabels({
          owner,
          repo,
          issue_number: issueNumber,
          labels,
        })
      );

      logger.debug(`Added labels [${labels.join(', ')}] to issue #${issueNumber} in ${owner}/${repo}`);
    } catch (error) {
      throw new GitHubError(`Failed to add labels to issue #${issueNumber} in repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        issueNumber,
        labels,
      });
    }
  }

  /**
   * Remove labels from an issue
   */
  async removeLabelsFromIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[]
  ): Promise<void> {
    try {
      for (const label of labels) {
        await this.client.executeRest(() =>
          this.client.octokit.issues.removeLabel({
            owner,
            repo,
            issue_number: issueNumber,
            name: label,
          })
        );
      }

      logger.debug(`Removed labels [${labels.join(', ')}] from issue #${issueNumber} in ${owner}/${repo}`);
    } catch (error) {
      throw new GitHubError(`Failed to remove labels from issue #${issueNumber} in repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        issueNumber,
        labels,
      });
    }
  }

  /**
   * Set labels for an issue (replaces all existing labels)
   */
  async setIssueLabels(
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[]
  ): Promise<void> {
    try {
      await this.client.executeRest(() =>
        this.client.octokit.issues.setLabels({
          owner,
          repo,
          issue_number: issueNumber,
          labels,
        })
      );

      logger.debug(`Set labels [${labels.join(', ')}] for issue #${issueNumber} in ${owner}/${repo}`);
    } catch (error) {
      throw new GitHubError(`Failed to set labels for issue #${issueNumber} in repository '${owner}/${repo}'`, {
        cause: error,
        owner,
        repo,
        issueNumber,
        labels,
      });
    }
  }

  /**
   * Ensure an issue exists, creating or updating it as necessary
   */
  async ensureIssue(owner: string, repo: string, title: string, options: CreateIssueOptions): Promise<Issue> {
    const existingIssue = await this.findIssueByTitle(owner, repo, title);
    
    if (existingIssue) {
      // Check if update is needed
      const needsUpdate = 
        existingIssue.body !== options.body ||
        !this.arraysEqual(existingIssue.labels.map(l => l.name), options.labels || []) ||
        !this.arraysEqual(existingIssue.assignees.map(a => a.login), options.assignees || []) ||
        existingIssue.milestone?.number !== options.milestone;

      if (needsUpdate) {
        logger.debug(`Updating issue '${title}' in ${owner}/${repo}`);
        return await this.updateIssue(owner, repo, existingIssue.number, {
          body: options.body,
          labels: options.labels,
          assignees: options.assignees,
          milestone: options.milestone,
        });
      }
      
      logger.debug(`Issue '${title}' already exists and is up to date in ${owner}/${repo}`);
      return existingIssue;
    }

    logger.info(`Creating issue '${title}' in ${owner}/${repo}`);
    return await this.createIssue(owner, repo, { ...options, title });
  }

  /**
   * Create multiple issues in batches
   */
  async createIssues(owner: string, repo: string, issues: CreateIssueOptions[]): Promise<Issue[]> {
    const results: Issue[] = [];
    
    // Process issues in batches to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < issues.length; i += batchSize) {
      const batch = issues.slice(i, i + batchSize);
      const batchPromises = batch.map(issue => this.createIssue(owner, repo, issue));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to be gentle on rate limits
      if (i + batchSize < issues.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    logger.info(`Created ${results.length} issues in ${owner}/${repo}`);
    return results;
  }

  /**
   * Map GitHub API issue response to our Issue interface
   */
  private mapIssue(apiIssue: any): Issue {
    return {
      id: apiIssue.id,
      number: apiIssue.number,
      title: apiIssue.title,
      body: apiIssue.body || undefined,
      state: apiIssue.state,
      labels: apiIssue.labels.map((label: any) => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description || undefined,
      })),
      assignees: apiIssue.assignees.map((assignee: any) => ({
        id: assignee.id,
        login: assignee.login,
      })),
      milestone: apiIssue.milestone ? {
        id: apiIssue.milestone.id,
        number: apiIssue.milestone.number,
        title: apiIssue.milestone.title,
      } : undefined,
      url: apiIssue.url,
      htmlUrl: apiIssue.html_url,
      createdAt: apiIssue.created_at,
      updatedAt: apiIssue.updated_at,
      closedAt: apiIssue.closed_at || undefined,
    };
  }

  /**
   * Check if two arrays are equal (order independent)
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, index) => val === sortedB[index]);
  }
}

// Singleton instance
let issuesServiceInstance: GitHubIssuesService | null = null;

/**
 * Get or create the GitHub issues service singleton
 */
export function getGitHubIssuesService(): GitHubIssuesService {
  if (!issuesServiceInstance) {
    issuesServiceInstance = new GitHubIssuesService();
  }
  return issuesServiceInstance;
}

/**
 * Reset the issues service singleton (useful for testing)
 */
export function resetGitHubIssuesService(): void {
  issuesServiceInstance = null;
}
