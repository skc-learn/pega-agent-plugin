/**
 * PII Masker - Field Classification and Tokenization
 *
 * Runs FIRST before any data is transmitted externally.
 * Classification → Tokenization → Token Map (memory only)
 */

import { PIICategory } from '../shared/message-types.js';

/**
 * PII classification patterns
 * Matches against (label + testId) combined string
 */
const PII_PATTERNS = {
  [PIICategory.NAME]: [
    /first.?name|fname|given.?name/i,
    /last.?name|lname|surname/i,
    /full.?name|customer.?name|client.?name|member.?name/i,
    /contact.?name|applicant.?name/i,
  ],
  [PIICategory.SSN]: [
    /ssn|social.?security|tax.?id|tin/i,
    /national.?id|government.?id/i,
  ],
  [PIICategory.DOB]: [
    /date.?of.?birth|dob|birth.?date/i,
    /birthday|born.?on/i,
  ],
  [PIICategory.EMAIL]: [
    /email|e-mail|email.?address/i,
  ],
  [PIICategory.PHONE]: [
    /phone|mobile|cell|telephone|contact.?number/i,
    /fax/i,
  ],
  [PIICategory.ACCOUNT]: [
    /account.?num|acct.?num|account.?id/i,
    /card.?num|credit.?card|debit.?card/i,
    /policy.?num|claim.?num/i,
  ],
  [PIICategory.ADDRESS]: [
    /address|street|city|state|zip|postal/i,
    /location|residence/i,
  ],
};

/**
 * PII Masker class
 * Maintains token map in memory only - never persisted
 */
class PIIMasker {
  constructor() {
    // Token maps stored per category - in memory only
    this.tokenMaps = new Map();
    // Counters per category for unique tokens
    this.counters = new Map();
    // Categories currently enabled for masking
    this.enabledCategories = new Set(Object.values(PIICategory));
  }

  /**
   * Configure which categories to mask
   * @param {string[]} categories - Array of PIICategory values
   */
  configure(categories) {
    this.enabledCategories = new Set(categories);
  }

  /**
   * Classify a field as PII based on label and testId
   * @param {string} label - Field label
   * @param {string} testId - Field data-test-id
   * @returns {string|null} - PIICategory or null
   */
  classifyField(label, testId) {
    const combined = `${label} ${testId}`.toLowerCase();

    for (const [category, patterns] of Object.entries(PII_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(combined)) {
          return category;
        }
      }
    }
    return null;
  }

  /**
   * Check if a category should be masked
   * @param {string} category - PIICategory
   * @returns {boolean}
   */
  shouldMask(category) {
    return category && this.enabledCategories.has(category);
  }

  /**
   * Mask a value by creating a token
   * @param {string} value - Raw value to mask
   * @param {string} category - PIICategory
   * @returns {string} - Token like "{NAME_1}"
   */
  mask(value, category) {
    if (!value || !this.shouldMask(category)) {
      return value;
    }

    // Initialize category map if needed
    if (!this.tokenMaps.has(category)) {
      this.tokenMaps.set(category, new Map());
      this.counters.set(category, 0);
    }

    const categoryMap = this.tokenMaps.get(category);
    const counter = this.counters.get(category);

    // Check if value already has a token
    for (const [token, existingValue] of categoryMap.entries()) {
      if (existingValue === value) {
        return token;
      }
    }

    // Create new token
    const newCounter = counter + 1;
    this.counters.set(category, newCounter);
    const token = `{${category}_${newCounter}}`;
    categoryMap.set(token, value);

    return token;
  }

  /**
   * Unmask a token back to original value
   * @param {string} token - Token like "{NAME_1}"
   * @returns {string} - Original value or token if not found
   */
  unmask(token) {
    if (!token || typeof token !== 'string' || !token.startsWith('{')) {
      return token;
    }

    // Parse category from token
    const match = token.match(/^\{([A-Z]+)_(\d+)\}$/);
    if (!match) {
      return token;
    }

    const [, category] = match;
    const categoryMap = this.tokenMaps.get(category);

    if (!categoryMap) {
      return token;
    }

    return categoryMap.get(token) || token;
  }

  /**
   * Batch mask an array of field objects
   * @param {Array} fields - Array of field objects with label, testId, value
   * @returns {Array} - Fields with masked values and piiCategory added
   */
  maskFields(fields) {
    return fields.map((field) => {
      const category = this.classifyField(field.label, field.testId);
      const maskedValue = this.mask(field.value, category);

      return {
        ...field,
        value: maskedValue,
        piiCategory: category,
        isMasked: maskedValue !== field.value,
      };
    });
  }

  /**
   * Unmask all tokens in a string
   * @param {string} text - Text containing tokens
   * @returns {string} - Text with tokens replaced by values
   */
  unmaskString(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    // Find all tokens in the string
    const tokenPattern = /\{([A-Z]+)_(\d+)\}/g;
    return text.replace(tokenPattern, (match) => this.unmask(match));
  }

  /**
   * Get token map for a category (for debugging/audit)
   * @param {string} category - PIICategory
   * @returns {Object} - Token map as plain object
   */
  getTokenMap(category) {
    const map = this.tokenMaps.get(category);
    return map ? Object.fromEntries(map) : {};
  }

  /**
   * Get all token maps (for debugging only)
   * @returns {Object} - All token maps
   */
  getAllTokenMaps() {
    const result = {};
    for (const [category, map] of this.tokenMaps.entries()) {
      result[category] = Object.fromEntries(map);
    }
    return result;
  }

  /**
   * Clear all tokens and counters
   * Called on session/tab close
   */
  clearSession() {
    this.tokenMaps.clear();
    this.counters.clear();
  }

  /**
   * Get statistics about current masking state
   * @returns {Object} - Stats object
   */
  getStats() {
    let totalTokens = 0;
    const byCategory = {};

    for (const [category, map] of this.tokenMaps.entries()) {
      const count = map.size;
      byCategory[category] = count;
      totalTokens += count;
    }

    return {
      totalTokens,
      byCategory,
      enabledCategories: Array.from(this.enabledCategories),
    };
  }
}

// Export singleton instance
export const piiMasker = new PIIMasker();

// Also export class for testing
export { PIIMasker };

export default piiMasker;
