/**
 * Intent Classifier - Local Intent Classification
 *
 * Classifies commands locally before LLM to reduce latency and cost.
 * Returns confidence scores and LLM requirement flag.
 */

import type { IntentType, IntentClassification } from './types';

// ============================================================================
// INTENT PATTERNS
// ============================================================================

interface IntentPattern {
  intent: IntentType;
  patterns: RegExp[];
  confidence: number;
  requiresLLM: boolean;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'SUMMARIZE_CASE',
    patterns: [
      /summarize|summary|what('?s| is) this case|brief me|catch me up/i,
    ],
    confidence: 0.95,
    requiresLLM: false,
  },
  {
    intent: 'SUBMIT_CASE',
    patterns: [
      /submit|complete this case|finish|close case/i,
    ],
    confidence: 0.90,
    requiresLLM: false,
  },
  {
    intent: 'SAVE_CASE',
    patterns: [
      /^save$|save changes|save and continue/i,
    ],
    confidence: 0.90,
    requiresLLM: false,
  },
  {
    intent: 'NEXT_STEP',
    patterns: [
      /^next$|next step|continue|proceed/i,
    ],
    confidence: 0.90,
    requiresLLM: false,
  },
  {
    intent: 'SHOW_QUEUE',
    patterns: [
      /^my queue$/i,
      /^my cases$/i,
      /what('?s| is) in my queue/i,
      /^show my work$/i,
    ],
    confidence: 0.90,
    requiresLLM: false,
  },
  {
    intent: 'ESCALATE',
    patterns: [
      /^escalate\b/i,
      /^transfer\s+(to|this|the|a)/i,
      /^route\s+(to|this|the|a)/i,
      /^assign\s+(to|this|the|a)/i,
    ],
    confidence: 0.85,
    requiresLLM: true,
  },
  {
    intent: 'CREATE_CASE',
    patterns: [
      /create|new case|open a new|start a new/i,
    ],
    confidence: 0.85,
    requiresLLM: true,
  },
  {
    intent: 'OPEN_CASE',
    patterns: [
      /open case|go to case|find case [A-Z0-9]+/i,
    ],
    confidence: 0.85,
    requiresLLM: true,
  },
  {
    intent: 'SEARCH',
    patterns: [
      /\bfind\s+cases\b/i,
      /\bsearch\s+for\b/i,
      /\blook\s+up\b/i,
      /\bshow\s+me\s+cases\b/i,
    ],
    confidence: 0.80,
    requiresLLM: true,
  },
  {
    intent: 'UPDATE_FIELD',
    patterns: [
      /^update\s+(the|this|a)\s+(status|priority|value|field|name|amount|date|type)\b/i,
      /^set\s+((the|this|a)\s+)?(status|priority|value)\s+to\s+/i,
      /^change\s+(the|this|a)\s+(status|priority|value)\b/i,
      /^fill\s+in\s+(the|this|a)\s+(status|priority|value|field|form)\b/i,
      /^enter\s+.+\s+in\s+(the|this|a)\s+\w+\s+field\b/i,
      /^put\s+.+\s+in\s+(the|this|a)?\s*\w+\b/i,
    ],
    confidence: 0.80,
    requiresLLM: true,
  },
  {
    intent: 'EXPLAIN',
    patterns: [
      /why|explain|reason|tell me about/i,
    ],
    confidence: 0.80,
    requiresLLM: true,
  },
];

// ============================================================================
// CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * Classify user command intent
 */
export function classifyIntent(command: string): IntentClassification {
  if (!command || command.trim().length === 0) {
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      requiresLLM: true,
    };
  }

  const normalizedCommand = command.trim().toLowerCase();

  for (const pattern of INTENT_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(normalizedCommand)) {
        return {
          intent: pattern.intent,
          confidence: pattern.confidence,
          requiresLLM: pattern.requiresLLM,
        };
      }
    }
  }

  // No pattern matched - return UNKNOWN with LLM required
  return {
    intent: 'UNKNOWN',
    confidence: 0,
    requiresLLM: true,
  };
}

/**
 * Check if intent requires LLM processing
 */
export function requiresLLM(intent: IntentType): boolean {
  const llmRequiredIntents: IntentType[] = [
    'UPDATE_FIELD',
    'CREATE_CASE',
    'SEARCH',
    'OPEN_CASE',
    'ESCALATE',
    'EXPLAIN',
    'UNKNOWN',
    'AMBIGUOUS',
  ];

  return llmRequiredIntents.includes(intent);
}

/**
 * Check if intent can be handled locally
 */
export function isLocalIntent(intent: IntentType): boolean {
  return !requiresLLM(intent);
}

/**
 * Get all supported intents
 */
export function getSupportedIntents(): IntentType[] {
  return INTENT_PATTERNS.map((p) => p.intent);
}
