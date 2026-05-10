/**
 * Pega Detector - Detect Pega Infinity in the current tab
 *
 * Runs in content script isolated world, DOM APIs only.
 * Six detection signals with confidence scoring.
 */

import type { PegaDetectionResult, UIFramework } from '../shared/types';
import {
  PEGA_CONSTELLATION_SELECTORS,
  PEGA_CLASSIC_SELECTORS,
  PEGA_COSMOS_SELECTORS,
  determineUIFramework,
} from '../shared/pega-heuristics';

// ============================================================================
// DETECTION SIGNALS
// ============================================================================

interface DetectionSignal {
  name: string;
  check: () => boolean;
  framework?: 'constellation' | 'classic' | 'cosmos';
}

/**
 * Create detection signals for Pega platform
 */
function createDetectionSignals(): DetectionSignal[] {
  return [
    // Signal 1: URL pattern detection (strong indicator)
    {
      name: 'url-pattern',
      check: () => {
        const url = window.location.href.toLowerCase();
        const hostname = window.location.hostname.toLowerCase();
        // Check for Pega URL patterns
        const urlPatterns = [
          'pegacloud.io',
          'pega.com',
          'pegalabs.io',  // User's environment
          'prweb',        // Common in Pega URLs
          '/prweb/',
          'pegaonline',
        ];
        const hasPattern = urlPatterns.some(p => url.includes(p) || hostname.includes(p));
        if (hasPattern) {
          console.log('[Pega Agent] URL pattern detected:', url);
          return true;
        }
        return false;
      },
    },

    // Signal 2: meta[name="pega-application"]
    {
      name: 'meta-pega-application',
      check: () => {
        const meta = document.querySelector('meta[name="pega-application"]');
        return meta !== null;
      },
    },

    // Signal 3: Constellation selectors
    {
      name: 'constellation-root',
      check: () => {
        return PEGA_CONSTELLATION_SELECTORS.some(
          (selector) => document.querySelector(selector) !== null
        );
      },
      framework: 'constellation',
    },

    // Signal 4: Classic UI selectors
    {
      name: 'classic-ui',
      check: () => {
        return PEGA_CLASSIC_SELECTORS.some(
          (selector) => document.querySelector(selector) !== null
        );
      },
      framework: 'classic',
    },

    // Signal 5: Pega-prefixed CSS classes anywhere in DOM (most reliable)
    {
      name: 'pega-css-classes',
      check: () => {
        // Check for any element with "pega" in class name
        const pegaClassElements = document.querySelectorAll('[class*="pega"]');
        if (pegaClassElements.length > 0) {
          console.log('[Pega Agent] Found', pegaClassElements.length, 'elements with "pega" in class');
          return true;
        }
        // Also check for px-, py-, pz- prefixes (Pega property prefixes)
        const pegaPrefixElements = document.querySelectorAll('[class*="px-"], [class*="py-"], [class*="pz-"]');
        return pegaPrefixElements.length > 0;
      },
    },

    // Signal 6: meta[name="pega-version"]
    {
      name: 'meta-pega-version',
      check: () => {
        const meta = document.querySelector('meta[name="pega-version"]');
        return meta !== null;
      },
    },

    // Signal 7: HTML comment with Pega Platform version
    {
      name: 'html-comment-version',
      check: () => {
        const html = document.documentElement.outerHTML;
        return /Pega Platform ([\d.]+)/i.test(html);
      },
    },

    // Signal 8: Generic Pega data attributes
    {
      name: 'pega-data-attributes',
      check: () => {
        const selectors = [
          '[data-pega]',
          '[data-pegaclass]',
          '[data-case-id]',
          '[data-assignment]',
          '[data-py-page]',
          '[data-px-ref]',
        ];
        return selectors.some(s => document.querySelector(s) !== null);
      },
    },

    // Signal 9: Pega scripts or iframes (WebWB, prweb, etc.)
    {
      name: 'pega-resources',
      check: () => {
        // Check for Pega-specific script/iframe sources
        const pegaResources = document.querySelectorAll('script[src*="prweb"], iframe[src*="prweb"], script[src*="pega"], link[href*="pega"]');
        if (pegaResources.length > 0) {
          console.log('[Pega Agent] Found', pegaResources.length, 'Pega resource links');
          return true;
        }
        return false;
      },
    },
  ];
}

// ============================================================================
// VERSION EXTRACTION
// ============================================================================

/**
 * Extract Pega version from various sources
 */
function extractVersion(): string {
  // Try meta tag first
  const versionMeta = document.querySelector('meta[name="pega-version"]');
  if (versionMeta) {
    const content = versionMeta.getAttribute('content');
    if (content) return content;
  }

  // Try HTML comment
  const html = document.documentElement.outerHTML;
  const commentMatch = html.match(/Pega Platform ([\d.]+)/i);
  if (commentMatch?.[1]) {
    return commentMatch[1];
  }

  // Try Constellation version attribute
  const pegaRoot = document.querySelector('#pega-ui-root, [data-pega-app]');
  if (pegaRoot) {
    const version = pegaRoot.getAttribute('data-pega-version');
    if (version) return version;
  }

  return 'unknown';
}

/**
 * Extract application name from meta tag
 */
function extractAppName(): string | undefined {
  const appMeta = document.querySelector('meta[name="pega-application"]');
  return appMeta?.getAttribute('content') ?? undefined;
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect Pega Infinity in the current page
 * Returns null if confidence < 0.15 (lowered to account for URL-only detection)
 */
export function detectPega(): PegaDetectionResult | null {
  const signals = createDetectionSignals();
  const firedSignals: DetectionSignal[] = [];

  console.log('[Pega Agent] Running detection on:', window.location.href);

  // Run all detection signals
  for (const signal of signals) {
    try {
      if (signal.check()) {
        firedSignals.push(signal);
        console.log('[Pega Agent] Signal fired:', signal.name);
      }
    } catch (e) {
      console.warn('[Pega Agent] Signal check failed:', signal.name, e);
    }
  }

  // Calculate confidence (signals fired / total signals)
  const confidence = firedSignals.length / signals.length;

  console.log('[Pega Agent] Detection result:', {
    firedCount: firedSignals.length,
    totalCount: signals.length,
    confidence: (confidence * 100).toFixed(1) + '%',
    firedSignals: firedSignals.map(s => s.name),
  });

  // Return null if confidence too low (lowered threshold to 10% for URL-only detection)
  if (confidence < 0.10) {
    console.warn('[Pega Agent] Confidence too low, detection failed');
    return null;
  }

  // Determine UI framework
  let constellationDetected = false;
  let classicDetected = false;
  let cosmosDetected = false;

  for (const signal of firedSignals) {
    if (signal.framework === 'constellation') constellationDetected = true;
    if (signal.framework === 'classic') classicDetected = true;

    // Check for Cosmos selectors
    if (PEGA_COSMOS_SELECTORS.some((s) => document.querySelector(s) !== null)) {
      cosmosDetected = true;
    }
  }

  const uiFramework: UIFramework = determineUIFramework(
    constellationDetected,
    classicDetected,
    cosmosDetected
  );

  return {
    isPega: true,
    confidence,
    uiFramework,
    version: extractVersion(),
    appName: extractAppName(),
  };
}

/**
 * Quick check if current page is likely Pega
 * Used for early exit before full detection
 */
export function isLikelyPega(): boolean {
  const url = window.location.href.toLowerCase();
  const hostname = window.location.hostname.toLowerCase();

  console.log('[Pega Agent] Quick check for Pega URL:', url);

  // URL pattern checks (expanded to include more Pega environments)
  const urlPatterns = [
    'pegacloud.io',
    'pega.com',
    'pegalabs.io',
    'pegasystems',
    'prweb',
    '/prweb/',
    'pegaonline',
  ];

  if (urlPatterns.some(p => url.includes(p) || hostname.includes(p))) {
    console.log('[Pega Agent] URL pattern matched, proceeding with detection');
    return true;
  }

  // Check for common Pega indicators
  const domIndicators = document.querySelector(
    '[data-pega-app], [data-pega], #pega-ui-root, .pega-ui-form, [data-pegaclass]'
  );
  if (domIndicators) {
    console.log('[Pega Agent] DOM indicator found, proceeding with detection');
    return true;
  }

  console.log('[Pega Agent] No Pega indicators found, skipping detection');
  return false;
}
