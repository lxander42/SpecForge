import { logger } from '../telemetry/logger.js';
import { SpecForgeError, AIError } from '../../lib/errors.js';

// AI capability types
export type AICapability = 
  | 'text-generation'
  | 'text-completion'
  | 'requirement-drafting'
  | 'checklist-pruning'
  | 'documentation-generation'
  | 'code-generation'
  | 'analysis';

// AI provider types
export type AIProviderType = 
  | 'openai'
  | 'azure-openai'
  | 'anthropic'
  | 'bedrock'
  | 'local'
  | 'mock';

// AI request and response interfaces
export interface AIRequest {
  prompt: string;
  capability: AICapability;
  context?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
  provider: AIProviderType;
  model?: string;
  requestId?: string;
}

// AI provider configuration
export interface AIProviderConfig {
  type: AIProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  allowedCapabilities?: AICapability[];
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

// Abstract AI provider interface
export abstract class AIProvider {
  protected config: AIProviderConfig;
  protected allowedCapabilities: Set<AICapability>;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.allowedCapabilities = new Set(config.allowedCapabilities || []);
  }

  /**
   * Check if a capability is allowed for this provider
   */
  isCapabilityAllowed(capability: AICapability): boolean {
    return this.allowedCapabilities.has(capability);
  }

  /**
   * Generate AI response for a request
   */
  async generate(request: AIRequest): Promise<AIResponse> {
    // Validate capability is allowed
    if (!this.isCapabilityAllowed(request.capability)) {
      throw new AIError(`AI capability '${request.capability}' is not allowed for provider '${this.config.type}'`);
    }

    // Apply AI guardrails
    this.validateRequest(request);

    try {
      logger.debug(`AI request: ${request.capability}`, {
        provider: this.config.type,
        model: this.config.model,
        promptLength: request.prompt.length,
      });

      const response = await this.executeRequest(request);
      
      logger.debug(`AI response received`, {
        provider: response.provider,
        contentLength: response.content.length,
        usage: response.usage,
      });

      return response;
    } catch (error) {
      throw new AIError(`AI generation failed for capability '${request.capability}'`, {
        cause: error,
        provider: this.config.type,
        capability: request.capability,
      });
    }
  }

  /**
   * Execute the actual AI request (implemented by concrete providers)
   */
  protected abstract executeRequest(request: AIRequest): Promise<AIResponse>;

  /**
   * Validate request against AI guardrails
   */
  private validateRequest(request: AIRequest): void {
    // Prohibited capabilities for engineering tasks
    const prohibitedForEngineering = [
      'design', 'analysis', 'verification', 'validation', 'safety', 'compliance',
      'fea', 'simulation', 'schematic', 'pcb', 'layout', 'review'
    ];

    const promptLower = request.prompt.toLowerCase();
    const hasProhibitedContent = prohibitedForEngineering.some(keyword => 
      promptLower.includes(keyword)
    );

    if (hasProhibitedContent && !this.isAllowedEngineeringCapability(request.capability)) {
      throw new AIError(
        'AI assistance is prohibited for engineering design, analysis, and verification tasks',
        {
          capability: request.capability,
          reason: 'engineering_guardrail',
        }
      );
    }

    // Validate prompt length
    if (request.prompt.length > 50000) {
      throw new AIError('AI prompt exceeds maximum length of 50,000 characters');
    }

    // Validate token limits
    const maxTokens = request.maxTokens || this.config.maxTokens || 4000;
    if (maxTokens > 8000) {
      throw new AIError('AI response token limit exceeds maximum of 8,000 tokens');
    }
  }

  /**
   * Check if capability is allowed for engineering tasks
   */
  private isAllowedEngineeringCapability(capability: AICapability): boolean {
    const allowedForEngineering: AICapability[] = [
      'documentation-generation',
      'checklist-pruning',
      'text-generation',
    ];
    return allowedForEngineering.includes(capability);
  }
}

// OpenAI provider implementation
export class OpenAIProvider extends AIProvider {
  protected async executeRequest(request: AIRequest): Promise<AIResponse> {
    // Mock implementation for now - would integrate with actual OpenAI API
    const mockResponse = this.generateMockResponse(request);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return mockResponse;
  }

  private generateMockResponse(request: AIRequest): AIResponse {
    let content = '';
    
    switch (request.capability) {
      case 'requirement-drafting':
        content = 'The system shall provide [capability] with [performance criteria] under [conditions].';
        break;
      case 'checklist-pruning':
        content = JSON.stringify({
          keep: ['critical-task-1', 'critical-task-2'],
          remove: ['optional-task-1', 'redundant-task-2'],
          rationale: 'Removed tasks that are not applicable to this project scope',
        });
        break;
      case 'documentation-generation':
        content = '# Generated Documentation\n\nThis section provides an overview of the system requirements and implementation approach.';
        break;
      default:
        content = 'AI-generated response for: ' + request.prompt.substring(0, 100);
    }

    return {
      content,
      usage: {
        promptTokens: Math.floor(request.prompt.length / 4),
        completionTokens: Math.floor(content.length / 4),
        totalTokens: Math.floor((request.prompt.length + content.length) / 4),
      },
      provider: 'openai',
      model: this.config.model || 'gpt-3.5-turbo',
      requestId: `req_${Date.now()}`,
    };
  }
}

// Mock provider for testing
export class MockAIProvider extends AIProvider {
  protected async executeRequest(request: AIRequest): Promise<AIResponse> {
    return {
      content: `Mock AI response for: ${request.capability}`,
      usage: {
        promptTokens: 10,
        completionTokens: 10,
        totalTokens: 20,
      },
      provider: 'mock',
      model: 'mock-model',
      requestId: `mock_${Date.now()}`,
    };
  }
}

// AI service class that manages providers
export class AIService {
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private defaultProvider: AIProviderType = 'mock';

  /**
   * Register an AI provider
   */
  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.config.type, provider);
    logger.info(`Registered AI provider: ${provider.config.type}`);
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(type: AIProviderType): void {
    if (!this.providers.has(type)) {
      throw new SpecForgeError(`AI provider '${type}' is not registered`);
    }
    this.defaultProvider = type;
    logger.info(`Set default AI provider: ${type}`);
  }

  /**
   * Generate AI response using the default or specified provider
   */
  async generate(request: AIRequest, providerType?: AIProviderType): Promise<AIResponse> {
    const provider = this.getProvider(providerType || this.defaultProvider);
    return provider.generate(request);
  }

  /**
   * Check if a capability is available
   */
  isCapabilityAvailable(capability: AICapability, providerType?: AIProviderType): boolean {
    try {
      const provider = this.getProvider(providerType || this.defaultProvider);
      return provider.isCapabilityAllowed(capability);
    } catch {
      return false;
    }
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(providerType: AIProviderType): AICapability[] {
    const provider = this.getProvider(providerType);
    return Array.from(provider.allowedCapabilities);
  }

  /**
   * Generate requirements text using AI
   */
  async generateRequirement(
    context: string,
    requirementType: string,
    existingRequirements?: string[]
  ): Promise<string> {
    const prompt = this.buildRequirementPrompt(context, requirementType, existingRequirements);
    
    const response = await this.generate({
      prompt,
      capability: 'requirement-drafting',
      context: {
        requirementType,
        existingCount: existingRequirements?.length || 0,
      },
    });

    return response.content;
  }

  /**
   * Prune WBS checklist using AI
   */
  async pruneChecklist(
    checklist: string[],
    projectContext: Record<string, unknown>
  ): Promise<{ keep: string[]; remove: string[]; rationale: string }> {
    const prompt = this.buildChecklistPrompt(checklist, projectContext);
    
    const response = await this.generate({
      prompt,
      capability: 'checklist-pruning',
      context: projectContext,
    });

    try {
      return JSON.parse(response.content);
    } catch (error) {
      throw new AIError('Failed to parse AI checklist pruning response', {
        cause: error,
        response: response.content,
      });
    }
  }

  /**
   * Generate documentation using AI
   */
  async generateDocumentation(
    topic: string,
    context: Record<string, unknown>,
    format: 'markdown' | 'text' = 'markdown'
  ): Promise<string> {
    const prompt = this.buildDocumentationPrompt(topic, context, format);
    
    const response = await this.generate({
      prompt,
      capability: 'documentation-generation',
      context: { topic, format, ...context },
    });

    return response.content;
  }

  /**
   * Get a provider by type
   */
  private getProvider(type: AIProviderType): AIProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new SpecForgeError(`AI provider '${type}' is not registered`);
    }
    return provider;
  }

  /**
   * Build prompt for requirement generation
   */
  private buildRequirementPrompt(
    context: string,
    requirementType: string,
    existingRequirements?: string[]
  ): string {
    let prompt = `Generate a ${requirementType} requirement for the following context:\n\n${context}\n\n`;
    
    if (existingRequirements && existingRequirements.length > 0) {
      prompt += `Existing requirements to avoid duplication:\n`;
      existingRequirements.forEach((req, index) => {
        prompt += `${index + 1}. ${req}\n`;
      });
      prompt += '\n';
    }

    prompt += `Please provide a clear, testable requirement following the format: "The system shall [action] [object] [condition]."`;
    
    return prompt;
  }

  /**
   * Build prompt for checklist pruning
   */
  private buildChecklistPrompt(
    checklist: string[],
    projectContext: Record<string, unknown>
  ): string {
    let prompt = `Given the following project context:\n`;
    prompt += JSON.stringify(projectContext, null, 2);
    prompt += `\n\nAnd this checklist of tasks:\n`;
    
    checklist.forEach((item, index) => {
      prompt += `${index + 1}. ${item}\n`;
    });

    prompt += `\nPlease identify which tasks should be kept or removed for this specific project.`;
    prompt += `\nRespond with JSON in this format:`;
    prompt += `\n{`;
    prompt += `\n  "keep": ["task1", "task2"],`;
    prompt += `\n  "remove": ["task3", "task4"],`;
    prompt += `\n  "rationale": "explanation of pruning decisions"`;
    prompt += `\n}`;

    return prompt;
  }

  /**
   * Build prompt for documentation generation
   */
  private buildDocumentationPrompt(
    topic: string,
    context: Record<string, unknown>,
    format: string
  ): string {
    let prompt = `Generate ${format} documentation for: ${topic}\n\n`;
    prompt += `Context:\n${JSON.stringify(context, null, 2)}\n\n`;
    prompt += `Please provide comprehensive documentation that includes:`;
    prompt += `\n- Overview and purpose`;
    prompt += `\n- Key features and capabilities`;
    prompt += `\n- Usage instructions`;
    prompt += `\n- Examples where applicable`;
    
    return prompt;
  }
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

/**
 * Get or create the AI service singleton
 */
export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
    
    // Register default mock provider
    const mockProvider = new MockAIProvider({
      type: 'mock',
      allowedCapabilities: [
        'text-generation',
        'requirement-drafting',
        'checklist-pruning',
        'documentation-generation',
      ],
    });
    
    aiServiceInstance.registerProvider(mockProvider);
    aiServiceInstance.setDefaultProvider('mock');
  }
  return aiServiceInstance;
}

/**
 * Reset the AI service singleton (useful for testing)
 */
export function resetAIService(): void {
  aiServiceInstance = null;
}

/**
 * Initialize AI service with providers based on configuration
 */
export function initializeAIService(configs: AIProviderConfig[]): AIService {
  const service = getAIService();
  
  for (const config of configs) {
    let provider: AIProvider;
    
    switch (config.type) {
      case 'openai':
      case 'azure-openai':
        provider = new OpenAIProvider(config);
        break;
      case 'mock':
        provider = new MockAIProvider(config);
        break;
      default:
        logger.warn(`Unsupported AI provider type: ${config.type}`);
        continue;
    }
    
    service.registerProvider(provider);
    
    // Set first non-mock provider as default
    if (config.type !== 'mock' && service.getAvailableProviders().length === 1) {
      service.setDefaultProvider(config.type);
    }
  }
  
  return service;
}
