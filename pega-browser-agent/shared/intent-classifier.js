/**
 * Intent Classifier - Local Intent Classification
 *
 * Classifies user commands into intents using pattern matching.
 * Only triggers LLM when confidence is below threshold or entity extraction is needed.
 */

import { IntentType } from './message-types.js';

/**
 * Intent patterns for local classification
 * Format: [patterns, requiresLLM, confidence]
 */
const INTENT_PATTERNS = {
  [IntentType.SUMMARIZE_CASE]: {
    patterns: [
      /summarize/i,
      /summary/i,
      /catch me up/i,
      /brief me/i,
      /what'?s this case/i,
      /tell me about this case/i,
      /give me an overview/i,
    ],
    requiresLLM: false,
    confidence: 0.95,
  },

  [IntentType.SUBMIT_CASE]: {
    patterns: [
      /submit/i,
      /complete\s+(this\s+)?case/i,
      /finish\s+(this\s+)?case/i,
      /close\s+(this\s+)?case/i,
      /finalize/i,
      /approve\s+and\s+submit/i,
    ],
    requiresLLM: false,
    confidence: 0.95,
  },

  [IntentType.SAVE_CASE]: {
    patterns: [
      /save/i,
      /save\s+changes/i,
      /save\s+(this\s+)?case/i,
      /apply\s+changes/i,
      /update\s+case/i,
    ],
    requiresLLM: false,
    confidence: 0.95,
  },

  [IntentType.NEXT_STEP]: {
    patterns: [
      /next/i,
      /continue/i,
      /proceed/i,
      /go\s+to\s+next/i,
      /move\s+forward/i,
      /next\s+step/i,
    ],
    requiresLLM: false,
    confidence: 0.95,
  },

  [IntentType.SHOW_QUEUE]: {
    patterns: [
      /my\s+queue/i,
      /my\s+cases/i,
      /show\s+queue/i,
      /open\s+cases/i,
      /work\s+list/i,
      /worklist/i,
      /task\s+list/i,
    ],
    requiresLLM: false,
    confidence: 0.95,
  },

  [IntentType.UPDATE_FIELD]: {
    patterns: [
      /update\s+(the\s+)?(\w+)/i,
      /set\s+(the\s+)?(\w+)/i,
      /change\s+(the\s+)?(\w+)/i,
      /fill\s+in\s+(\w+)/i,
      /enter\s+(\w+)/i,
      /modify\s+(\w+)/i,
    ],
    requiresLLM: true, // Need to extract field name and value
    confidence: 0.85,
  },

  [IntentType.ESCALATE]: {
    patterns: [
      /escalate/i,
      /transfer/i,
      /route\s+to/i,
      /assign\s+to/i,
      /reassign/i,
      /hand\s+off/i,
      /delegate/i,
    ],
    requiresLLM: true, // Need to extract assignee
    confidence: 0.85,
  },

  [IntentType.CREATE_CASE]: {
    patterns: [
      /create\s+(a\s+)?(new\s+)?case/i,
      /new\s+case/i,
      /start\s+(a\s+)?case/i,
      /open\s+(a\s+)?case/i,
      /begin\s+(a\s+)?case/i,
    ],
    requiresLLM: true, // Need to extract case type
    confidence: 0.85,
  },

  [IntentType.SEARCH]: {
    patterns: [
      /find\s+(\w+)/i,
      /search\s+(for\s+)?(\w+)/i,
      /look\s+up\s+(\w+)/i,
      /locate\s+(\w+)/i,
      /retrieve\s+(\w+)/i,
    ],
    requiresLLM: true, // Need to extract search query
    confidence: 0.85,
  },

  [IntentType.EXPLAIN]: {
    patterns: [
      /why/i,
      /explain\s+/i,
      /reason\s+for/i,
      /tell\s+me\s+why/i,
      /what\s+is\s+the\s+reason/i,
      /help\s+me\s+understand/i,
    ],
    requiresLLM: true, // Need reasoning
    confidence: 0.80,
  },
};

/**
 * Minimum confidence threshold for local classification
 */
const CONFIDENCE_THRESHOLD = 0.90;

/**
 * Intent Classifier class
 */
class IntentClassifier {
  constructor() {
    this.confidenceThreshold = CONFIDENCE_THRESHOLD;
  }

  /**
   * Classify a user command
   * @param {string} command - User's natural language command
   * @returns {Object} - Classification result
   */
  classify(command) {
    if (!command || typeof command !== 'string') {
      return {
        intent: IntentType.UNKNOWN,
        confidence: 0,
        requiresLLM: true,
        entities: {},
      };
    }

    const normalizedCommand = command.trim().toLowerCase();

    // Try each intent pattern
    const results = [];

    for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (pattern.test(normalizedCommand)) {
          results.push({
            intent,
            confidence: config.confidence,
            requiresLLM: config.requiresLLM,
            matchedPattern: pattern.source,
          });
          break; // Found match for this intent
        }
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    if (results.length === 0) {
      return {
        intent: IntentType.UNKNOWN,
        confidence: 0,
        requiresLLM: true,
        entities: {},
      };
    }

    const bestMatch = results[0];

    // Extract entities if needed
    const entities = this.extractEntities(normalizedCommand, bestMatch.intent);

    return {
      intent: bestMatch.intent,
      confidence: bestMatch.confidence,
      requiresLLM: bestMatch.requiresLLM || bestMatch.confidence < this.confidenceThreshold,
      entities,
      alternatives: results.slice(1, 3), // Return top 2 alternatives
    };
  }

  /**
   * Extract entities from command based on intent
   * @param {string} command - Normalized command
   * @param {string} intent - Classified intent
   * @returns {Object} - Extracted entities
   */
  extractEntities(command, intent) {
    const entities = {};

    switch (intent) {
      case IntentType.UPDATE_FIELD: {
        // Try to extract field name and value
        const updateMatch = command.match(
          /(?:update|set|change|fill\s+in|enter|modify)\s+(?:the\s+)?(\w+)\s+(?:to|as|=)\s+["']?([^"']+)["']?/i
        );
        if (updateMatch) {
          entities.fieldName = updateMatch[1];
          entities.fieldValue = updateMatch[2];
        }
        break;
      }

      case IntentType.ESCALATE: {
        // Try to extract assignee
        const escalateMatch = command.match(
          /(?:escalate|transfer|route|assign|reassign|hand\s+off|delegate)\s+(?:to\s+)?["']?([^"']+)["']?/i
        );
        if (escalateMatch) {
          entities.assignee = escalateMatch[1];
        }
        break;
      }

      case IntentType.CREATE_CASE: {
        // Try to extract case type
        const createMatch = command.match(
          /(?:create|start|open|begin)\s+(?:a\s+)?(?:new\s+)?(\w+(?:\s+\w+)?)\s*case/i
        );
        if (createMatch) {
          entities.caseType = createMatch[1];
        }
        break;
      }

      case IntentType.SEARCH: {
        // Try to extract search query
        const searchMatch = command.match(
          /(?:find|search\s+(?:for\s+)?|look\s+up|locate|retrieve)\s+["']?([^"']+)["']?/i
        );
        if (searchMatch) {
          entities.query = searchMatch[1];
        }
        break;
      }
    }

    return entities;
  }

  /**
   * Check if intent can be handled locally
   * @param {string} intent - Intent type
   * @returns {boolean}
   */
  canHandleLocally(intent) {
    const config = INTENT_PATTERNS[intent];
    return config && !config.requiresLLM;
  }

  /**
   * Set confidence threshold
   * @param {number} threshold - New threshold (0-1)
   */
  setConfidenceThreshold(threshold) {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Get all supported intents
   * @returns {string[]}
   */
  getSupportedIntents() {
    return Object.keys(INTENT_PATTERNS);
  }

  /**
   * Get intent description
   * @param {string} intent - Intent type
   * @returns {Object}
   */
  getIntentInfo(intent) {
    const config = INTENT_PATTERNS[intent];
    if (!config) {
      return null;
    }

    return {
      intent,
      patterns: config.patterns.map((p) => p.source),
      requiresLLM: config.requiresLLM,
      baseConfidence: config.confidence,
    };
  }
}

// Export singleton instance
export const intentClassifier = new IntentClassifier();

// Also export class for testing
export { IntentClassifier };

export default intentClassifier;
