/**
 * PII Masker - Field Classification and Tokenization
 *
 * Runs FIRST before any data is transmitted externally.
 * Classification → Tokenization → Token Map (memory only)
 *
 * CRITICAL: Raw values NEVER transmitted. Token Map NEVER persisted.
 */

import type { PiiCategory, ParsedField } from '../shared/types';

// ============================================================================
// PII CLASSIFICATION PATTERNS
// ============================================================================

const PII_PATTERNS: Record<Exclude<PiiCategory, null>, RegExp[]> = {
  NAME: [
    /first.?name|fname|given.?name/i,
    /last.?name|lname|surname/i,
    /full.?name|customer.?name|client.?name|member.?name/i,
    /contact.?name|applicant.?name|insured.?name/i,
  ],
  SSN: [
    /ssn|social.?security|tax.?id|tin/i,
    /national.?id|government.?id|ein/i,
  ],
  DOB: [
    /date.?of.?birth|dob|birth.?date/i,
    /birthday|born.?on/i,
  ],
  EMAIL: [
    /email|e-mail|email.?address/i,
  ],
  PHONE: [
    /phone|mobile|cell|telephone|contact.?number/i,
    /fax/i,
  ],
  ACCOUNT: [
    /account.?num|acct.?num|account.?id/i,
    /card.?num|credit.?card|debit.?card/i,
    /policy.?num|claim.?num|loan.?num/i,
  ],
  ADDRESS: [
    /address|street|city|state|zip|postal/i,
    /location|residence/i,
  ],
  INCOME: [
    /income|salary|annual.?income/i,
  ],
};

// ============================================================================
// PII MASKER CLASS
// ============================================================================

/**
 * PII Masker - Singleton pattern for content script
 * Maintains token map in memory only - never persisted
 */
class PIIMasker {
  private tokenMaps: Map<string, Map<string, string>> = new Map();
  private counters: Map<string, number> = new Map();
  private enabledCategories: Set<string>;

  constructor() {
    this.enabledCategories = new Set(Object.keys(PII_PATTERNS));
  }

  /**
   * Configure which categories to mask
   */
  configure(categories: string[]): void {
    this.enabledCategories = new Set(categories);
  }

  /**
   * Classify a field as PII based on label and testId
   */
  classify(label: string | null, testId: string | null): PiiCategory {
    const combined = `${label ?? ''} ${testId ?? ''}`.toLowerCase();

    for (const [category, patterns] of Object.entries(PII_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(combined)) {
          return category as PiiCategory;
        }
      }
    }
    return null;
  }

  /**
   * Check if a category should be masked
   */
  shouldMask(category: PiiCategory): boolean {
    return category !== null && this.enabledCategories.has(category);
  }

  /**
   * Mask a value by creating a token
   * Returns token like "{NAME_1}" or original value if not maskable
   */
  mask(value: string | null, category: PiiCategory): string | null {
    if (value === null || value === undefined || value === '') {
      return value;
    }

    if (!this.shouldMask(category)) {
      return value;
    }

    // Initialize category map if needed (category is guaranteed non-null by shouldMask)
    const categoryKey = category as string;
    if (!this.tokenMaps.has(categoryKey)) {
      this.tokenMaps.set(categoryKey, new Map());
      this.counters.set(categoryKey, 0);
    }

    const categoryMap = this.tokenMaps.get(categoryKey)!;
    const counter = this.counters.get(categoryKey)!;

    // Check if value already has a token
    for (const [token, existingValue] of categoryMap.entries()) {
      if (existingValue === value) {
        return token;
      }
    }

    // Create new token
    const newCounter = counter + 1;
    this.counters.set(categoryKey, newCounter);
    const token = `{${categoryKey}_${newCounter}}`;
    categoryMap.set(token, value);

    return token;
  }

  /**
   * Resolve a token back to original value
   * Called ONLY in action-executor at execution time
   */
  resolve(token: string | null | undefined): string | null {
    if (!token || typeof token !== 'string' || !token.startsWith('{')) {
      return token ?? null;
    }

    // Parse category from token: {NAME_1}
    const match = token.match(/^\{([A-Z]+)_(\d+)\}$/);
    if (!match?.[1]) {
      return token;
    }

    const category = match[1];
    const categoryMap = this.tokenMaps.get(category);

    if (!categoryMap) {
      return token;
    }

    const resolved = categoryMap.get(token);
    return resolved ?? token;
  }

  /**
   * Resolve all tokens in a string
   */
  resolveString(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    const tokenPattern = /\{([A-Z]+)_(\d+)\}/g;
    return text.replace(tokenPattern, (match) => {
      const resolved = this.resolve(match);
      return resolved ?? match;
    });
  }

  /**
   * Resolve all tokens in an action plan
   * De-tokenize all step values before DOM execution
   */
  resolveInPlan(plan: { steps: Array<{ value?: string }> }): void {
    for (const step of plan.steps) {
      if (step.value) {
        step.value = this.resolveString(step.value);
      }
    }
  }

  /**
   * Mask an array of parsed fields
   */
  maskFields(fields: ParsedField[]): ParsedField[] {
    return fields.map((field) => {
      const category = this.classify(field.label, field.testId);
      const maskedValue = this.mask(field.value, category);

      return {
        ...field,
        value: maskedValue,
        piiCategory: category,
        piiToken: maskedValue !== field.value ? maskedValue : null,
      };
    });
  }

  /**
   * Clear all tokens and counters
   * Called on session/tab close
   */
  clearSession(): void {
    this.tokenMaps.clear();
    this.counters.clear();
  }

  /**
   * Get statistics about current masking state
   */
  getStats(): { totalTokens: number; byCategory: Record<string, number> } {
    let totalTokens = 0;
    const byCategory: Record<string, number> = {};

    for (const [category, map] of this.tokenMaps.entries()) {
      const count = map.size;
      byCategory[category] = count;
      totalTokens += count;
    }

    return { totalTokens, byCategory };
  }
}

// Export singleton instance
export const piiMasker = new PIIMasker();

// Also export class for testing
export { PIIMasker };
