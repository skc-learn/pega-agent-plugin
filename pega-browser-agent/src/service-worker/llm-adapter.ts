/**
 * LLM Adapter - Multi-Provider LLM Interface
 *
 * Supports multiple providers with automatic fallback.
 * Providers: Azure OpenAI, OpenAI, Anthropic, Google, Mistral, Local endpoints.
 */

import type { LLMResponse, LLMConfig, MultiLLMConfig, DOMSnapshot, CaseSummary } from '../shared/types';
import {
  LLMProviderError,
  LLMTimeoutError,
  LLMInvalidResponseError,
} from '../shared/types';
import {
  detectCaseDomain,
  getDomainMetadata,
} from '../shared/pega-heuristics';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 1;

// ============================================================================
// PROVIDER CONFIGURATIONS
// ============================================================================

interface ProviderConfig {
  url: (config: LLMConfig) => string;
  headers: (config: LLMConfig) => Record<string, string>;
  body: (config: LLMConfig, systemPrompt: string, userPrompt: string) => unknown;
  parseResponse: (data: unknown) => { content: string; tokensUsed: number };
}

const PROVIDERS: Record<string, ProviderConfig> = {
  'azure-openai': {
    url: (config) =>
      `${config.endpoint}/openai/deployments/${config.model}/chat/completions?api-version=${config.apiVersion ?? '2024-02-15-preview'}`,
    headers: (config) => ({
      'Content-Type': 'application/json',
      'api-key': config.apiKey ?? '',
    }),
    body: (config, systemPrompt, userPrompt) => ({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
    parseResponse: (data) => {
      const response = data as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      };
      return {
        content: response.choices?.[0]?.message?.content ?? '',
        tokensUsed: response.usage?.total_tokens ?? 0,
      };
    },
  },

  openai: {
    url: () => 'https://api.openai.com/v1/chat/completions',
    headers: (config) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey ?? ''}`,
    }),
    body: (config, systemPrompt, userPrompt) => ({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
    parseResponse: (data) => {
      const response = data as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      };
      return {
        content: response.choices?.[0]?.message?.content ?? '',
        tokensUsed: response.usage?.total_tokens ?? 0,
      };
    },
  },

  anthropic: {
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: (config) => ({
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    }),
    body: (config, systemPrompt, userPrompt) => ({
      model: config.model || 'claude-sonnet-4-20250514',
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    parseResponse: (data) => {
      const response = data as {
        content?: Array<{ text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const textContent = response.content?.find((c) => c.text);
      return {
        content: textContent?.text ?? '',
        tokensUsed:
          (response.usage?.input_tokens ?? 0) +
          (response.usage?.output_tokens ?? 0),
      };
    },
  },

  local: {
    url: (config) => config.endpoint,
    headers: () => ({
      'Content-Type': 'application/json',
    }),
    body: (config, systemPrompt, userPrompt) => ({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
    parseResponse: (data) => {
      const response = data as {
        choices?: Array<{ message?: { content?: string } }>;
        text?: string;
        tokens_used?: number;
      };
      return {
        content: response.choices?.[0]?.message?.content ?? response.text ?? '',
        tokensUsed: response.tokens_used ?? 0,
      };
    },
  },

  google: {
    url: (config) =>
      `${config.endpoint || 'https://generativelanguage.googleapis.com'}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
    headers: () => ({
      'Content-Type': 'application/json',
    }),
    body: (config, systemPrompt, userPrompt) => ({
      contents: [
        {
          parts: [
            { text: `${systemPrompt}\n\n${userPrompt}` }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
      },
    }),
    parseResponse: (data) => {
      const response = data as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
        usageMetadata?: { totalTokenCount?: number };
      };
      return {
        content: response.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
        tokensUsed: response.usageMetadata?.totalTokenCount ?? 0,
      };
    },
  },

  mistral: {
    url: () => 'https://api.mistral.ai/v1/chat/completions',
    headers: (config) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey ?? ''}`,
    }),
    body: (config, systemPrompt, userPrompt) => ({
      model: config.model || 'mistral-large-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
    parseResponse: (data) => {
      const response = data as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      };
      return {
        content: response.choices?.[0]?.message?.content ?? '',
        tokensUsed: response.usage?.total_tokens ?? 0,
      };
    },
  },
};

// ============================================================================
// LLM ADAPTER CLASS
// ============================================================================

class LLMAdapter {
  private config: LLMConfig | null = null;
  private multiConfig: MultiLLMConfig | null = null;
  private ready: boolean = false;

  /**
   * Configure the LLM adapter (single provider)
   */
  configure(config: LLMConfig): void {
    this.config = config;
    this.ready = !!(config.apiKey) || config.provider === 'local';
  }

  /**
   * Configure multiple LLM providers with fallback
   */
  configureMulti(config: MultiLLMConfig): void {
    this.multiConfig = config;
    // Filter to enabled providers with API keys
    const enabledProviders = config.providers.filter(
      p => p.enabled !== false && (p.apiKey || p.provider === 'local')
    );
    this.ready = enabledProviders.length > 0;
  }

  /**
   * Check if adapter is ready
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Get enabled providers sorted by priority
   */
  private getEnabledProviders(): LLMConfig[] {
    if (this.multiConfig) {
      return this.multiConfig.providers
        .filter(p => p.enabled !== false && (p.apiKey || p.provider === 'local'))
        .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    }
    if (this.config) {
      return [this.config];
    }
    return [];
  }

  /**
   * Complete a prompt with automatic fallback
   */
  async complete(
    systemPrompt: string,
    userPrompt: string
  ): Promise<LLMResponse> {
    const providers = this.getEnabledProviders();

    if (providers.length === 0) {
      throw new LLMProviderError('LLM not configured', 'unknown');
    }

    const errors: Error[] = [];

    // Try each provider in priority order
    for (const providerConfig of providers) {
      try {
        const result = await this.completeWithProvider(
          providerConfig,
          systemPrompt,
          userPrompt
        );
        return result;
      } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
          console.warn(`Provider ${providerConfig.provider} failed:`, error);

          // If we have more providers to try, continue
          if (providers.indexOf(providerConfig) < providers.length - 1) {
            continue;
          }
        }
    }

    // All providers failed
    throw new LLMProviderError(
      `All LLM providers failed. Errors: ${errors.map(e => e.message).join('; ')}`,
      'multi'
    );
  }

  /**
   * Complete a prompt with a specific provider
   */
  private async completeWithProvider(
    config: LLMConfig,
    systemPrompt: string,
    userPrompt: string
  ): Promise<LLMResponse> {
    const provider = PROVIDERS[config.provider];
    if (!provider) {
      throw new LLMProviderError(
        `Unknown provider: ${config.provider}`,
        config.provider
      );
    }

    const startTime = performance.now();

    try {
      const response = await this.fetchWithRetry(
        provider.url(config),
        {
          method: 'POST',
          headers: provider.headers(config),
          body: JSON.stringify(
            provider.body(config, systemPrompt, userPrompt)
          ),
        },
        this.multiConfig?.maxRetries ?? MAX_RETRIES
      );

      const data = await response.json();
      const parsed = provider.parseResponse(data);

      if (!parsed.content) {
        throw new LLMInvalidResponseError('Empty response from LLM');
      }

      return {
        content: parsed.content,
        model: config.model,
        tokensUsed: parsed.tokensUsed,
        latencyMs: performance.now() - startTime,
        provider: config.provider,
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }

      throw new LLMProviderError(
        error instanceof Error ? error.message : 'Unknown error',
        config.provider,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Fetch with retry on 429
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retriesLeft: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429 && retriesLeft > 0) {
        // Wait and retry once
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return this.fetchWithRetry(url, options, retriesLeft - 1);
      }

      if (!response.ok) {
        throw new LLMProviderError(
          `HTTP ${response.status}: ${response.statusText}`,
          this.config?.provider ?? 'unknown'
        );
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMTimeoutError();
      }

      throw error;
    }
  }

  // =========================================================================
  // SUMMARY GENERATION
  // =========================================================================

  /**
   * Generate a case summary with Pega framework and domain context
   */
  async generateSummary(context: {
    caseContext: DOMSnapshot['caseContext'];
    fields: DOMSnapshot['fields'];
    actions?: DOMSnapshot['actions'];
    pegaContext?: {
      uiFramework: string;
      version: string;
      appName?: string;
    };
  }): Promise<{ summary: CaseSummary; tokensUsed: number; latencyMs: number }> {
    // Detect domain from case class
    const detectedDomain = detectCaseDomain(context.caseContext.caseClass);
    const domainMetadata = detectedDomain ? getDomainMetadata(detectedDomain) : null;

    // Build domain-specific context
    const domainContext = domainMetadata ? `
**DETECTED DOMAIN: ${domainMetadata.industry} - ${domainMetadata.subIndustry}**
- Typical Stages: ${domainMetadata.typicalStages.join(' → ')}
- Common Actors: ${domainMetadata.commonActors.join(', ')}
- Risk Factors: ${domainMetadata.riskFactors.join(', ')}
` : '';

    // Build framework-specific context
    const frameworkContext = context.pegaContext ? `
**PEGA ENVIRONMENT:**
- UI Framework: ${(context.pegaContext.uiFramework ?? 'unknown').toUpperCase()} (${this.getFrameworkDescription(context.pegaContext.uiFramework ?? 'unknown')})
- Pega Version: ${context.pegaContext.version ?? 'unknown'}
- Application: ${context.pegaContext.appName || 'Unknown'}
` : '';

    // Build SLA context with deadline awareness
    const slaContext = this.buildSLAContext(context.caseContext);

    // Build available actions context
    const actionsContext = this.buildActionsContext(context.actions);

    const systemPrompt = `You are a Pega Infinity case management expert with deep platform knowledge.

${frameworkContext}
${domainContext}
**Pega Platform Expertise:**
- Case lifecycle: Intake → Processing stages → Resolution
- Stage transitions: Flow actions trigger stage changes, local actions stay in current stage
- SLA management: Goal (response time), Deadline (escalation), Passed Deadline (overdue)
- Assignment routing: Workbaskets, work queues, skill-based routing
- UI Frameworks: Constellation (React), Cosmos (Angular), Classic (JSP)
- Data patterns: Clipboard pages, Data Pages, Data Transforms
- Case relationships: Parent/child, coverage, joined cases

**Action Types in Pega:**
- Flow Actions: Submit, Complete, Approve, Reject, Next (advance case stage)
- Local Actions: Add Note, Print, Refresh (no stage transition)
- Bulk Actions: Operations affecting multiple cases

**SLA Analysis:**
- Check if SLA deadline is approaching or passed
- Consider urgency level when prioritizing recommendations
- Flag cases at risk of SLA breach

**Analysis Framework:**
1. SITUATION: What is this case about? Who is the requester, what do they need?
2. HISTORY: Path through stages, time spent, key decisions
3. CURRENT STATE: Current stage, pending assignments, blockers, available actions
4. RISK SIGNALS: SLA breaches, missing info, policy issues, fraud indicators, deadline risks
5. RECOMMENDATION: Specific, actionable next step considering urgency and available actions

Be OPINIONATED - tell the case worker what matters most based on SLA status and case context.

Output ONLY valid JSON:
{
  "situation": "One sentence: who wants what and why",
  "history": "2-3 sentences: path through stages, key decisions",
  "currentState": "What's pending, complete, and blocking",
  "riskSignals": ["Specific risk 1", "Specific risk 2"],
  "recommendedNextAction": "Specific actionable step with reasoning"
}`;

    // Filter non-PII fields for summary
    const nonPiiFields = context.fields
      .filter((f) => !f.piiCategory)
      .map((f) => `${f.label}: ${f.value}`)
      .join('\n');

    const userPrompt = `Summarize this Pega case. All PII is masked with tokens.

CASE DATA:
${JSON.stringify(context.caseContext, null, 2)}
${slaContext}
${actionsContext}
FIELD VALUES (non-PII fields only):
${nonPiiFields}`;

    const response = await this.complete(systemPrompt, userPrompt);

    // Parse JSON response
    let summaryData: Partial<CaseSummary>;
    try {
      // Remove markdown code fences if present
      let content = response.content.trim();
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      summaryData = JSON.parse(content);
    } catch {
      throw new LLMInvalidResponseError('Failed to parse summary JSON');
    }

    const summary: CaseSummary = {
      caseId: context.caseContext.caseId ?? 'unknown',
      caseType: context.caseContext.caseType ?? 'unknown',
      situation: summaryData.situation ?? 'Unable to summarize case situation.',
      history: summaryData.history ?? 'No history available.',
      currentState: summaryData.currentState ?? 'Current state unknown.',
      riskSignals: summaryData.riskSignals ?? [],
      recommendedNextAction: summaryData.recommendedNextAction ?? null,
      generatedAt: Date.now(),
      confidence: 0.85,
      model: response.model,
    };

    return {
      summary,
      tokensUsed: response.tokensUsed,
      latencyMs: response.latencyMs,
    };
  }

  /**
   * Build SLA context string with deadline awareness
   */
  private buildSLAContext(caseContext: DOMSnapshot['caseContext']): string {
    const parts: string[] = [];

    if (caseContext.slaDeadline) {
      parts.push(`SLA Deadline: ${caseContext.slaDeadline}`);
    }

    if (caseContext.urgency) {
      parts.push(`Urgency: ${caseContext.urgency}`);
    }

    if (caseContext.stageName) {
      parts.push(`Current Stage: ${caseContext.stageName}`);
    }

    if (parts.length === 0) {
      return '';
    }

    return `
**SLA & URGENCY STATUS:**
${parts.join('\n')}
`;
  }

  /**
   * Build actions context string showing available actions
   */
  private buildActionsContext(actions?: DOMSnapshot['actions']): string {
    if (!actions || actions.length === 0) {
      return '';
    }

    const flowActions = actions.filter(a => a.isFlowAction && !a.isDisabled);
    const localActions = actions.filter(a => a.isLocalAction && !a.isDisabled);

    const parts: string[] = [];

    if (flowActions.length > 0) {
      parts.push(`Flow Actions (advance stage): ${flowActions.map(a => a.label).join(', ')}`);
    }

    if (localActions.length > 0) {
      parts.push(`Local Actions (UI only): ${localActions.map(a => a.label).join(', ')}`);
    }

    if (parts.length === 0) {
      return '';
    }

    return `
**AVAILABLE ACTIONS:**
${parts.join('\n')}
`;
  }

  /**
   * Get human-readable framework description
   */
  private getFrameworkDescription(framework: string | undefined): string {
    const descriptions: Record<string, string> = {
      'constellation': 'Modern React-based UI with Constellation components, uses px-* elements and data-test-id attributes',
      'cosmos': 'Angular-based UI framework with traditional Pega patterns',
      'classic': 'Legacy JSP/harness-based UI, uses rule forms and traditional Pega selectors',
      'unknown': 'Framework not detected, using generic patterns',
    };
    const key = framework || 'unknown';
    return descriptions[key] ?? descriptions['unknown'] ?? 'Unknown framework';
  }
}

// Export singleton instance
export const llmAdapter = new LLMAdapter();

// Also export class for testing
export { LLMAdapter };
