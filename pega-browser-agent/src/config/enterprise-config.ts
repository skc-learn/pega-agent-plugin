/**
 * Enterprise Configuration
 *
 * Override defaults for enterprise deployments.
 */

import type { EnterpriseConfig } from '../shared/types';
import { DEFAULT_CONFIG } from './default-config';

/**
 * Create enterprise configuration by merging with defaults
 */
export function createEnterpriseConfig(
  overrides: Partial<EnterpriseConfig>
): EnterpriseConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    security: {
      ...DEFAULT_CONFIG.security,
      ...overrides.security,
    },
    llm: {
      ...DEFAULT_CONFIG.llm,
      ...overrides.llm,
    },
    pega: {
      ...DEFAULT_CONFIG.pega,
      ...overrides.pega,
    },
    roleRestrictions: {
      ...DEFAULT_CONFIG.roleRestrictions,
      ...overrides.roleRestrictions,
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: EnterpriseConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate LLM provider
  if (!['azure-openai', 'openai', 'anthropic', 'local'].includes(config.llm.provider)) {
    errors.push(`Invalid LLM provider: ${config.llm.provider}`);
  }

  // Validate endpoint for local provider
  if (config.llm.provider === 'local' && !config.llm.endpoint) {
    errors.push('Local LLM provider requires endpoint configuration');
  }

  // Validate temperature
  if (config.llm.temperature < 0 || config.llm.temperature > 2) {
    errors.push('LLM temperature must be between 0 and 2');
  }

  // Validate max tokens
  if (config.llm.maxTokens < 1 || config.llm.maxTokens > 100000) {
    errors.push('LLM maxTokens must be between 1 and 100000');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Load configuration from chrome.storage
 */
export async function loadConfig(): Promise<EnterpriseConfig> {
  try {
    const result = await chrome.storage.sync.get('pegaAgentConfig');
    if (result.pegaAgentConfig) {
      return createEnterpriseConfig(result.pegaAgentConfig);
    }
  } catch {
    // Ignore storage errors
  }

  return DEFAULT_CONFIG;
}

/**
 * Save configuration to chrome.storage
 */
export async function saveConfig(config: EnterpriseConfig): Promise<void> {
  await chrome.storage.sync.set({ pegaAgentConfig: config });
}
