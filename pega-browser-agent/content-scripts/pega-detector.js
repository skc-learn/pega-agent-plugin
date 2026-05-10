/**
 * Pega Detector - Detects Pega Infinity Application
 *
 * Detects Pega application using multiple signals and calculates confidence.
 * Identifies UI framework (Constellation vs Classic vs Unknown).
 */

import { PegaFramework, createMessage, MessageType } from '../shared/message-types.js';
import {
  PEGA_ROOT_SELECTORS,
  PEGA_META_PATTERNS,
  PEGA_DATA_ATTRIBUTES,
} from '../shared/pega-heuristics.js';

/**
 * Detection signals with weights
 */
const DETECTION_SIGNALS = {
  META_TAG: 0.25,
  ROOT_ELEMENT: 0.30,
  CLASS_PATTERNS: 0.15,
  URL_PATTERN: 0.15,
  DATA_ATTRIBUTES: 0.15,
};

/**
 * Confidence threshold for positive detection
 */
const DETECTION_THRESHOLD = 0.30;

/**
 * Pega Detector class
 */
class PegaDetector {
  constructor() {
    this.isDetected = false;
    this.confidence = 0;
    this.framework = PegaFramework.UNKNOWN;
    this.version = null;
    this.applicationName = null;
    this.detectionDetails = {};
  }

  /**
   * Run full detection process
   * @returns {Object} - Detection result
   */
  detect() {
    const signals = {
      metaTag: this.checkMetaTag(),
      rootElement: this.checkRootElement(),
      classPatterns: this.checkClassPatterns(),
      urlPattern: this.checkUrlPattern(),
      dataAttributes: this.checkDataAttributes(),
    };

    // Calculate weighted confidence
    let confidence = 0;
    let signalCount = 0;

    if (signals.metaTag.detected) {
      confidence += DETECTION_SIGNALS.META_TAG;
      signalCount++;
      this.applicationName = signals.metaTag.applicationName;
      this.version = signals.metaTag.version;
    }

    if (signals.rootElement.detected) {
      confidence += DETECTION_SIGNALS.ROOT_ELEMENT;
      signalCount++;
      this.framework = signals.rootElement.framework;
    }

    if (signals.classPatterns.detected) {
      confidence += DETECTION_SIGNALS.CLASS_PATTERNS;
      signalCount++;
    }

    if (signals.urlPattern.detected) {
      confidence += DETECTION_SIGNALS.URL_PATTERN;
      signalCount++;
    }

    if (signals.dataAttributes.detected) {
      confidence += DETECTION_SIGNALS.DATA_ATTRIBUTES;
      signalCount++;
    }

    this.confidence = confidence;
    this.isDetected = confidence >= DETECTION_THRESHOLD;
    this.detectionDetails = signals;

    const result = {
      isDetected: this.isDetected,
      confidence: this.confidence,
      framework: this.framework,
      version: this.version,
      applicationName: this.applicationName,
      signals: signalCount,
      details: signals,
    };

    // Notify service worker if detected
    if (this.isDetected) {
      this.notifyDetection(result);
    }

    return result;
  }

  /**
   * Check for Pega meta tags
   * @returns {Object}
   */
  checkMetaTag() {
    const result = { detected: false, applicationName: null, version: null };

    // Check for pega-application meta tag
    const appMeta = document.querySelector('meta[name="pega-application"]');
    if (appMeta) {
      result.detected = true;
      result.applicationName = appMeta.content;
    }

    // Check for pega-version meta tag
    const versionMeta = document.querySelector('meta[name="pega-version"]');
    if (versionMeta) {
      result.detected = true;
      result.version = versionMeta.content;
    }

    // Check for pega-framework meta tag
    const frameworkMeta = document.querySelector('meta[name="pega-framework"]');
    if (frameworkMeta) {
      result.detected = true;
    }

    return result;
  }

  /**
   * Check for Pega root elements
   * @returns {Object}
   */
  checkRootElement() {
    const result = { detected: false, framework: PegaFramework.UNKNOWN };

    // Check for Constellation root
    for (const selector of PEGA_ROOT_SELECTORS.constellation) {
      if (document.querySelector(selector)) {
        result.detected = true;
        result.framework = PegaFramework.CONSTELLATION;
        return result;
      }
    }

    // Check for Classic UI root
    for (const selector of PEGA_ROOT_SELECTORS.classic) {
      if (document.querySelector(selector)) {
        result.detected = true;
        result.framework = PegaFramework.CLASSIC;
        return result;
      }
    }

    return result;
  }

  /**
   * Check for Pega class patterns in DOM
   * @returns {Object}
   */
  checkClassPatterns() {
    const result = { detected: false, count: 0 };

    // Look for elements with pega- prefixed classes
    const pegaClasses = document.querySelectorAll('[class*="pega-"]');
    if (pegaClasses.length > 0) {
      result.detected = true;
      result.count = pegaClasses.length;
    }

    return result;
  }

  /**
   * Check for Pega URL patterns
   * @returns {Object}
   */
  checkUrlPattern() {
    const result = { detected: false, url: window.location.href };

    const url = window.location.href;

    // Check for Pega cloud domains
    if (url.includes('pegacloud.io') || url.includes('pega.com')) {
      result.detected = true;
    }

    // Check for case routes
    if (/\/case\//i.test(url) || /\/cases\//i.test(url)) {
      result.detected = true;
    }

    // Check for portal routes
    if (/\/portal\//i.test(url)) {
      result.detected = true;
    }

    return result;
  }

  /**
   * Check for Pega data attributes
   * @returns {Object}
   */
  checkDataAttributes() {
    const result = { detected: false, count: 0 };

    // Check for data-test-id attributes (Pega testing convention)
    const testIdElements = document.querySelectorAll(`[${PEGA_DATA_ATTRIBUTES.testId}]`);
    if (testIdElements.length > 0) {
      result.detected = true;
      result.count = testIdElements.length;
    }

    // Check for data-case-id attributes
    const caseIdElements = document.querySelectorAll(`[${PEGA_DATA_ATTRIBUTES.caseId}]`);
    if (caseIdElements.length > 0) {
      result.detected = true;
      result.count += caseIdElements.length;
    }

    return result;
  }

  /**
   * Notify service worker of detection
   * @param {Object} result - Detection result
   */
  notifyDetection(result) {
    const message = createMessage(MessageType.PEGA_DETECTED, {
      isDetected: result.isDetected,
      confidence: result.confidence,
      framework: result.framework,
      version: result.version,
      applicationName: result.applicationName,
      url: window.location.href,
      title: document.title,
    });

    chrome.runtime.sendMessage(message);
  }

  /**
   * Get current detection state
   * @returns {Object}
   */
  getState() {
    return {
      isDetected: this.isDetected,
      confidence: this.confidence,
      framework: this.framework,
      version: this.version,
      applicationName: this.applicationName,
    };
  }

  /**
   * Reset detection state
   */
  reset() {
    this.isDetected = false;
    this.confidence = 0;
    this.framework = PegaFramework.UNKNOWN;
    this.version = null;
    this.applicationName = null;
    this.detectionDetails = {};
  }

  /**
   * Re-run detection (for SPA navigation)
   * @returns {Object}
   */
  redetect() {
    this.reset();
    return this.detect();
  }
}

// Export singleton instance
export const pegaDetector = new PegaDetector();

// Also export class for testing
export { PegaDetector };

// Auto-run detection on script load
if (typeof window !== 'undefined') {
  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      pegaDetector.detect();
    });
  } else {
    // DOM already loaded
    setTimeout(() => pegaDetector.detect(), 100);
  }
}

export default pegaDetector;
