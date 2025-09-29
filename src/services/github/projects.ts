import { getGitHubClient } from './client.js';
import { GitHubError } from '../../lib/errors.js';
import { logger } from '../telemetry/logger.js';

export interface ProjectV2 {
  id: string;
  number: number;
  title: string;
  shortDescription?: string;
  readme?: string;
  url: string;
  closed: boolean;
  public: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectV2Field {
  id: string;
  name: string;
  dataType: 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'ITERATION';
  options?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
}

export interface ProjectV2Item {
  id: string;
  content?: {
    id: string;
    number?: number;
    title?: string;
    url?: string;
    repository?: {
      nameWithOwner: string;
    };
  };
  fieldValues: Array<{
    field: {
      id: string;
      name: string;
    };
    value?: string | number | { name: string };
  }>;
}

export interface CreateProjectOptions {
  title: string;
  shortDescription?: string;
  readme?: string;
  public?: boolean;
  template?: string;
}

export interface UpdateProjectOptions {
  title?: string;
  shortDescription?: string;
  readme?: string;
  public?: boolean;
  closed?: boolean;
}

export class GitHubProjectsService {
  private client = getGitHubClient();

  /**
   * Get all projects for an organization
   */
  async getOrgProjects(org: string): Promise<ProjectV2[]> {
    const query = `
      query getOrgProjects($org: String!, $cursor: String) {
        organization(login: $org) {
          projectsV2(first: 100, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              number
              title
              shortDescription
              readme
              url
              closed
              public
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    try {
      const projects: ProjectV2[] = [];
      let cursor: string | null = null;
      let hasNextPage = true;

      while (hasNextPage) {
        const response: any = await this.client.executeGraphQL(query, {
          org,
          cursor,
        });

        if (!response.organization) {
          throw new GitHubError(`Organization '${org}' not found or not accessible`);
        }

        const { nodes, pageInfo } = response.organization.projectsV2;
        projects.push(...nodes);

        hasNextPage = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor;
      }

      logger.debug(`Found ${projects.length} projects for org ${org}`);
      return projects;
    } catch (error) {
      throw new GitHubError(`Failed to get projects for organization '${org}'`, {
        cause: error,
        org,
      });
    }
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(user: string): Promise<ProjectV2[]> {
    const query = `
      query getUserProjects($user: String!, $cursor: String) {
        user(login: $user) {
          projectsV2(first: 100, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              number
              title
              shortDescription
              readme
              url
              closed
              public
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    try {
      const projects: ProjectV2[] = [];
      let cursor: string | null = null;
      let hasNextPage = true;

      while (hasNextPage) {
        const response: any = await this.client.executeGraphQL(query, {
          user,
          cursor,
        });

        if (!response.user) {
          throw new GitHubError(`User '${user}' not found or not accessible`);
        }

        const { nodes, pageInfo } = response.user.projectsV2;
        projects.push(...nodes);

        hasNextPage = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor;
      }

      logger.debug(`Found ${projects.length} projects for user ${user}`);
      return projects;
    } catch (error) {
      throw new GitHubError(`Failed to get projects for user '${user}'`, {
        cause: error,
        user,
      });
    }
  }

  /**
   * Find a project by title in organization or user account
   */
  async findProject(owner: string, title: string, isOrg: boolean = true): Promise<ProjectV2 | null> {
    try {
      const projects = isOrg 
        ? await this.getOrgProjects(owner)
        : await this.getUserProjects(owner);

      return projects.find(p => p.title === title) || null;
    } catch (error) {
      logger.warn(`Failed to find project '${title}' for ${isOrg ? 'org' : 'user'} '${owner}'`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Create a new project in an organization
   */
  async createOrgProject(org: string, options: CreateProjectOptions): Promise<ProjectV2> {
    const mutation = `
      mutation createProject($ownerId: ID!, $title: String!, $shortDescription: String, $readme: String, $public: Boolean, $template: String) {
        createProjectV2(input: {
          ownerId: $ownerId
          title: $title
          shortDescription: $shortDescription
          readme: $readme
          public: $public
          template: $template
        }) {
          projectV2 {
            id
            number
            title
            shortDescription
            readme
            url
            closed
            public
            createdAt
            updatedAt
          }
        }
      }
    `;

    try {
      // First get the organization ID
      const orgQuery = `
        query getOrg($org: String!) {
          organization(login: $org) {
            id
          }
        }
      `;

      const orgResponse: any = await this.client.executeGraphQL(orgQuery, { org });
      if (!orgResponse.organization) {
        throw new GitHubError(`Organization '${org}' not found`);
      }

      const response: any = await this.client.executeGraphQL(mutation, {
        ownerId: orgResponse.organization.id,
        title: options.title,
        shortDescription: options.shortDescription,
        readme: options.readme,
        public: options.public ?? false,
        template: options.template,
      });

      const project = response.createProjectV2.projectV2;
      logger.info(`Created project '${project.title}' (${project.number}) for org ${org}`);
      return project;
    } catch (error) {
      throw new GitHubError(`Failed to create project '${options.title}' for organization '${org}'`, {
        cause: error,
        org,
        title: options.title,
      });
    }
  }

  /**
   * Create a new project for a user
   */
  async createUserProject(user: string, options: CreateProjectOptions): Promise<ProjectV2> {
    const mutation = `
      mutation createProject($ownerId: ID!, $title: String!, $shortDescription: String, $readme: String, $public: Boolean, $template: String) {
        createProjectV2(input: {
          ownerId: $ownerId
          title: $title
          shortDescription: $shortDescription
          readme: $readme
          public: $public
          template: $template
        }) {
          projectV2 {
            id
            number
            title
            shortDescription
            readme
            url
            closed
            public
            createdAt
            updatedAt
          }
        }
      }
    `;

    try {
      // First get the user ID
      const userQuery = `
        query getUser($user: String!) {
          user(login: $user) {
            id
          }
        }
      `;

      const userResponse: any = await this.client.executeGraphQL(userQuery, { user });
      if (!userResponse.user) {
        throw new GitHubError(`User '${user}' not found`);
      }

      const response: any = await this.client.executeGraphQL(mutation, {
        ownerId: userResponse.user.id,
        title: options.title,
        shortDescription: options.shortDescription,
        readme: options.readme,
        public: options.public ?? false,
        template: options.template,
      });

      const project = response.createProjectV2.projectV2;
      logger.info(`Created project '${project.title}' (${project.number}) for user ${user}`);
      return project;
    } catch (error) {
      throw new GitHubError(`Failed to create project '${options.title}' for user '${user}'`, {
        cause: error,
        user,
        title: options.title,
      });
    }
  }

  /**
   * Update an existing project
   */
  async updateProject(projectId: string, options: UpdateProjectOptions): Promise<ProjectV2> {
    const mutation = `
      mutation updateProject($projectId: ID!, $title: String, $shortDescription: String, $readme: String, $public: Boolean, $closed: Boolean) {
        updateProjectV2(input: {
          projectId: $projectId
          title: $title
          shortDescription: $shortDescription
          readme: $readme
          public: $public
          closed: $closed
        }) {
          projectV2 {
            id
            number
            title
            shortDescription
            readme
            url
            closed
            public
            createdAt
            updatedAt
          }
        }
      }
    `;

    try {
      const response: any = await this.client.executeGraphQL(mutation, {
        projectId,
        ...options,
      });

      const project = response.updateProjectV2.projectV2;
      logger.info(`Updated project '${project.title}' (${project.number})`);
      return project;
    } catch (error) {
      throw new GitHubError(`Failed to update project with ID '${projectId}'`, {
        cause: error,
        projectId,
      });
    }
  }

  /**
   * Ensure a project exists, creating it if necessary
   */
  async ensureProject(
    owner: string,
    title: string,
    options: CreateProjectOptions,
    isOrg: boolean = true
  ): Promise<ProjectV2> {
    const existingProject = await this.findProject(owner, title, isOrg);
    if (existingProject) {
      logger.debug(`Project '${title}' already exists for ${isOrg ? 'org' : 'user'} '${owner}'`);
      return existingProject;
    }

    logger.info(`Creating project '${title}' for ${isOrg ? 'org' : 'user'} '${owner}'`);
    return isOrg 
      ? await this.createOrgProject(owner, options)
      : await this.createUserProject(owner, options);
  }

  /**
   * Get project fields
   */
  async getProjectFields(projectId: string): Promise<ProjectV2Field[]> {
    const query = `
      query getProjectFields($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 100) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  dataType
                  options {
                    id
                    name
                    color
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response: any = await this.client.executeGraphQL(query, { projectId });
      
      if (!response.node) {
        throw new GitHubError(`Project with ID '${projectId}' not found`);
      }

      return response.node.fields.nodes;
    } catch (error) {
      throw new GitHubError(`Failed to get fields for project '${projectId}'`, {
        cause: error,
        projectId,
      });
    }
  }

  /**
   * Add an item (issue or pull request) to a project
   */
  async addItemToProject(projectId: string, contentId: string): Promise<ProjectV2Item> {
    const mutation = `
      mutation addItemToProject($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {
          projectId: $projectId
          contentId: $contentId
        }) {
          item {
            id
            content {
              ... on Issue {
                id
                number
                title
                url
                repository {
                  nameWithOwner
                }
              }
              ... on PullRequest {
                id
                number
                title
                url
                repository {
                  nameWithOwner
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response: any = await this.client.executeGraphQL(mutation, {
        projectId,
        contentId,
      });

      const item = response.addProjectV2ItemById.item;
      logger.debug(`Added item ${item.content?.number} to project ${projectId}`);
      return item;
    } catch (error) {
      throw new GitHubError(`Failed to add item to project '${projectId}'`, {
        cause: error,
        projectId,
        contentId,
      });
    }
  }
}

// Singleton instance
let projectsServiceInstance: GitHubProjectsService | null = null;

/**
 * Get or create the GitHub projects service singleton
 */
export function getGitHubProjectsService(): GitHubProjectsService {
  if (!projectsServiceInstance) {
    projectsServiceInstance = new GitHubProjectsService();
  }
  return projectsServiceInstance;
}

/**
 * Reset the projects service singleton (useful for testing)
 */
export function resetGitHubProjectsService(): void {
  projectsServiceInstance = null;
}
