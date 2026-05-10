/**
 * Summary Generator - Case Summarization Orchestrator
 *
 * Generates structured case summary on case open.
 * Caches results by caseId + snapshotHash.
 */

import type { DOMSnapshot, CaseSummary, PegaDetectionResult } from '../shared/types';
import { llmAdapter } from './llm-adapter';
import { sessionStore } from './session-store';

// ============================================================================
// SUMMARY GENERATOR CLASS
// ============================================================================

class SummaryGenerator {
  /**
   * Generate a case summary with Pega framework context
   *
   * - Starts LLM call immediately when URL changes
   * - Caches result by caseId + snapshotHash
   * - Returns cached version instantly on re-open within same session
   * - Invalidates cache when action is executed on this case
   */
  async generate(
    tabId: number,
    snapshot: DOMSnapshot,
    pegaDetection?: PegaDetectionResult | null
  ): Promise<CaseSummary | null> {
    const caseId = snapshot.caseContext.caseId;

    if (!caseId) {
      return this.generatePlaceholder(snapshot, 'No case ID detected');
    }

    // Generate snapshot hash for cache validation
    const snapshotHash = sessionStore.generateSnapshotHash(snapshot);

    // Check cache first
    const cached = await sessionStore.getCachedSummary(tabId, caseId, snapshotHash);
    if (cached) {
      return cached;
    }

    // Check if LLM is configured
    if (!llmAdapter.isReady()) {
      return this.generatePlaceholder(
        snapshot,
        'Configure API key to enable AI summaries'
      );
    }

    try {
      // Build Pega context for domain-aware summary
      const pegaContext = pegaDetection ? {
        uiFramework: pegaDetection.uiFramework,
        version: pegaDetection.version,
        appName: pegaDetection.appName,
      } : undefined;

      // Generate summary using LLM with framework context and actions
      const result = await llmAdapter.generateSummary({
        caseContext: snapshot.caseContext,
        fields: snapshot.fields,
        actions: snapshot.actions,
        pegaContext,
      });

      // Cache the summary
      await sessionStore.cacheSummary(tabId, caseId, snapshotHash, result.summary);

      return result.summary;
    } catch (error) {
      console.error('Pega Agent: Summary generation failed', error);
      return this.generatePlaceholder(
        snapshot,
        error instanceof Error ? error.message : 'Failed to generate summary'
      );
    }
  }

  /**
   * Generate a placeholder summary when LLM is not available
   */
  private generatePlaceholder(
    snapshot: DOMSnapshot,
    message: string
  ): CaseSummary {
    return {
      caseId: snapshot.caseContext.caseId ?? 'unknown',
      caseType: snapshot.caseContext.caseType ?? 'unknown',
      situation: message,
      history: 'Enable AI summaries by configuring your API key in settings.',
      currentState: this.buildFieldSummary(snapshot),
      riskSignals: [],
      recommendedNextAction: null,
      generatedAt: Date.now(),
      confidence: 0,
      model: 'placeholder',
    };
  }

  /**
   * Build a basic field summary from snapshot
   */
  private buildFieldSummary(snapshot: DOMSnapshot): string {
    const nonPiiFields = snapshot.fields
      .filter((f) => !f.piiCategory && f.label && f.value)
      .slice(0, 5);

    if (nonPiiFields.length === 0) {
      return 'No field data available.';
    }

    return nonPiiFields
      .map((f) => `${f.label}: ${f.value}`)
      .join('\n');
  }

  /**
   * Invalidate summary cache for a case (called after action execution)
   */
  async invalidateCache(tabId: number, caseId: string): Promise<void> {
    await sessionStore.invalidateSummaryCache(tabId, caseId);
  }
}

// Export singleton instance
export const summaryGenerator = new SummaryGenerator();

// Also export class for testing
export { SummaryGenerator };
