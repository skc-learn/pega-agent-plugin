/**
 * Default Configuration
 *
 * Enterprise configuration with sensible defaults.
 */

import type { EnterpriseConfig } from '../shared/types';

export const DEFAULT_CONFIG: EnterpriseConfig = {
  version: '1.0',

  security: {
    piiMaskingEnabled: true,
    piiCategoriesToMask: ['NAME', 'SSN', 'DOB', 'EMAIL', 'PHONE', 'ACCOUNT', 'ADDRESS', 'INCOME'],
    localProcessingOnly: false,
    allowedLLMProviders: ['azure-openai', 'openai', 'anthropic', 'mistral'],
    auditLoggingEnabled: true,
    requireConfirmationForAllActions: false,
    disabledCapabilities: [],
  },

  llm: {
    provider: 'anthropic',
    endpoint: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1500,
    temperature: 0.1,
    apiKey: undefined,
  },

  pega: {
    targetDomains: [], // Empty = detect any Pega app via DOM signals
    useDirectAPI: false, // Rung 1 — DOM automation only
    cdh: {
      enabled: false,
    },
  },

  roleRestrictions: {
    caseWorker: [
      'SUMMARIZE_CASE',
      'UPDATE_FIELD',
      'SAVE_CASE',
      'NEXT_STEP',
      'SHOW_QUEUE',
      'SEARCH',
      'EXPLAIN',
    ],
    supervisor: ['*'],
    readOnly: ['SUMMARIZE_CASE', 'SHOW_QUEUE', 'EXPLAIN'],
  },
};
