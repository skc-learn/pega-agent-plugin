/**
 * LLM Adapter - BYOM Abstraction Layer
 *
 * Abstracts LLM provider behind a single interface.
 * Supports Anthropic Claude (default), Azure OpenAI, and OpenAI.
 */

/**
 * LLM Provider types
 */
const ProviderType = {
  ANTHROPIC: 'anthropic',
  AZURE_OPENAI: 'azure-openai',
  OPENAI: 'openai',
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  provider: ProviderType.ANTHROPIC,
  model: 'claude-sonnet-4-20250514',
  maxTokens: 1500,
  temperature: 0.1,
};

/**
 * LLM Adapter class
 */
class LLMAdapter {
  constructor(config = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.apiKey = null;
    this.endpoint = null;
    this.isInitialized = false;
  }

  /**
   * Initialize adapter with API credentials
   * @param {Object} credentials - API credentials
   */
  async initialize(credentials = {}) {
    // Get API key from credentials or chrome.storage
    if (credentials.apiKey) {
      this.apiKey = credentials.apiKey;
    } else {
      // Try to get from secure storage
      try {
        const result = await chrome.storage.session.get('llm-api-key');
        this.apiKey = result['llm-api-key'];
      } catch (error) {
        console.warn('LLMAdapter: No API key in storage');
      }
    }

    // Set custom endpoint if provided
    if (credentials.endpoint) {
      this.endpoint = credentials.endpoint;
    }

    // Override config if provided
    if (credentials.config) {
      this.config = {
        ...this.config,
        ...credentials.config,
      };
    }

    this.isInitialized = true;
  }

  /**
   * Set API key
   * @param {string} apiKey
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Set endpoint
   * @param {string} endpoint
   */
  setEndpoint(endpoint) {
    this.endpoint = endpoint;
  }

  /**
   * Complete a prompt
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @returns {Promise<Object>} - Completion result
   */
  async complete(systemPrompt, userPrompt) {
    if (!this.apiKey) {
      throw new Error('LLMAdapter: API key not configured');
    }

    const startTime = Date.now();

    try {
      let result;

      switch (this.config.provider) {
        case ProviderType.ANTHROPIC:
          result = await this.completeAnthropic(systemPrompt, userPrompt);
          break;

        case ProviderType.AZURE_OPENAI:
          result = await this.completeAzureOpenAI(systemPrompt, userPrompt);
          break;

        case ProviderType.OPENAI:
          result = await this.completeOpenAI(systemPrompt, userPrompt);
          break;

        default:
          throw new Error(`LLMAdapter: Unknown provider ${this.config.provider}`);
      }

      const latencyMs = Date.now() - startTime;

      return {
        content: result.content,
        tokensUsed: result.tokensUsed || 0,
        latencyMs,
        model: this.config.model,
        provider: this.config.provider,
      };
    } catch (error) {
      console.error('LLMAdapter: Completion error', error);
      throw error;
    }
  }

  /**
   * Complete using Anthropic Claude API
   * @param {string} systemPrompt
   * @param {string} userPrompt
   * @returns {Promise<Object>}
   */
  async completeAnthropic(systemPrompt, userPrompt) {
    const endpoint = this.endpoint || 'https://api.anthropic.com/v1/messages';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.content[0].text,
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0,
    };
  }

  /**
   * Complete using Azure OpenAI API
   * @param {string} systemPrompt
   * @param {string} userPrompt
   * @returns {Promise<Object>}
   */
  async completeAzureOpenAI(systemPrompt, userPrompt) {
    if (!this.endpoint) {
      throw new Error('LLMAdapter: Azure OpenAI requires endpoint configuration');
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      tokensUsed: data.usage?.total_tokens || 0,
    };
  }

  /**
   * Complete using OpenAI API
   * @param {string} systemPrompt
   * @param {string} userPrompt
   * @returns {Promise<Object>}
   */
  async completeOpenAI(systemPrompt, userPrompt) {
    const endpoint = this.endpoint || 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      tokensUsed: data.usage?.total_tokens || 0,
    };
  }

  /**
   * Generate case summary
   * @param {Object} caseContext - Case context from DOM parser
   * @returns {Promise<Object>}
   */
  async generateSummary(caseContext) {
    const systemPrompt = `You are a Pega case expert generating a structured 4-part case summary for a case worker.
Be concise and opinionated — prioritize what matters right now, not everything that exists.
Format output as JSON: { "situation": string, "history": string, "currentState": string, "riskSignal": string | null }
Note: All PII values are masked as tokens (e.g. {NAME_1}) — keep them masked in output.
Return ONLY valid JSON, no markdown formatting.`;

    const userPrompt = `Generate a case summary from this Pega case context:
${JSON.stringify(caseContext, null, 2)}

Return JSON with 4 fields:
- situation (2-3 sentences): Case type, customer identity (masked), how long open, case ID
- history (3-4 sentences): What has happened so far, key interactions, documents submitted — essential points only
- currentState (2-3 sentences): Current stage, what is blocking or pending, next expected action
- riskSignal (1-2 sentences or null): SLA proximity warning, customer sentiment signals, compliance flags (if any)`;

    const result = await this.complete(systemPrompt, userPrompt);

    // Parse JSON response
    try {
      // Remove any markdown code blocks if present
      let content = result.content.trim();
      if (content.startsWith('```json')) {
        content = content.slice(7);
      }
      if (content.startsWith('```')) {
        content = content.slice(3);
      }
      if (content.endsWith('```')) {
        content = content.slice(0, -3);
      }
      content = content.trim();

      const summary = JSON.parse(content);
      return {
        ...result,
        summary,
      };
    } catch (parseError) {
      console.error('LLMAdapter: Failed to parse summary JSON', parseError);
      throw new Error('Failed to parse LLM summary response');
    }
  }

  /**
   * Generate action plan from command
   * @param {Object} context - Full context including DOM snapshot
   * @param {string} command - User command
   * @returns {Promise<Object>}
   */
  async generatePlan(context, command) {
    const systemPrompt = `You are a Pega Infinity expert assistant.
Strict rules:
- Only reference fields/selectors from the provided DOM context
- Always return JSON action plan, never prose
- requiresConfirmation must be true for submit, escalate, delete actions
- If unclear, return { "type": "AMBIGUITY_REQUEST", "question": "..." }
- PII values are masked tokens — do not attempt to infer or unmask
Return ONLY valid JSON, no markdown formatting.`;

    const caseCtx = context.caseContext || {};
    const fields = context.fields || [];
    const actions = context.actions || [];

    const userPrompt = `CASE: ${caseCtx.caseType || 'Unknown'} | ID: ${caseCtx.caseId || 'Unknown'} | Status: ${caseCtx.status || 'Unknown'} | Stage: ${caseCtx.stage?.current || 'Unknown'}
SLA DEADLINE: ${caseCtx.slaDeadline || 'N/A'}
ASSIGNED TO: ${caseCtx.assignedTo || 'N/A'}

AVAILABLE FIELDS:
${fields.map((f) => `  ${f.label} | selector: ${f.selector} | type: ${f.fieldType} | current: ${f.value}`).join('\n')}

AVAILABLE ACTIONS:
${actions.map((a) => `  ${a.label} | selector: ${a.selector} | type: ${a.actionType} | disabled: ${a.disabled}`).join('\n')}

USER COMMAND: "${command}"

Return JSON:
{
  "intent": string,
  "summary": string,
  "requiresConfirmation": boolean,
  "steps": [
    {
      "stepNumber": number,
      "action": "CLICK" | "TYPE" | "SELECT" | "CLEAR" | "NAVIGATE" | "WAIT",
      "selector": string,
      "value": string | null,
      "description": string
    }
  ],
  "expectedOutcome": string
}`;

    const result = await this.complete(systemPrompt, userPrompt);

    // Parse JSON response
    try {
      let content = result.content.trim();
      if (content.startsWith('```json')) {
        content = content.slice(7);
      }
      if (content.startsWith('```')) {
        content = content.slice(3);
      }
      if (content.endsWith('```')) {
        content = content.slice(0, -3);
      }
      content = content.trim();

      const plan = JSON.parse(content);

      // Add metadata
      plan.id = `plan-${Date.now()}`;
      plan.caseId = caseCtx.caseId;
      plan.confirmed = false;
      plan.createdAt = Date.now();

      return {
        ...result,
        plan,
      };
    } catch (parseError) {
      console.error('LLMAdapter: Failed to parse plan JSON', parseError);
      throw new Error('Failed to parse LLM plan response');
    }
  }

  /**
   * Get current configuration
   * @returns {Object}
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param {Object} updates
   */
  updateConfig(updates) {
    this.config = {
      ...this.config,
      ...updates,
    };
  }

  /**
   * Check if adapter is ready
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized && !!this.apiKey;
  }
}

// Export singleton instance
export const llmAdapter = new LLMAdapter();

// Also export class and types for testing
export { LLMAdapter, ProviderType };

export default llmAdapter;
