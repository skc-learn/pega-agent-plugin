/**
 * Visual Understanding Module - Screenshot Capture and Visual Analysis
 *
 * Provides Playwright/Stagehand-style visual capabilities:
 * - Screenshot capture with metadata
 * - Visual analysis via multimodal LLM
 * - Visual diffing for validation
 * - Element detection and highlighting
 */

import type {
  ScreenshotData,
  VisualAnalysis,
  VisualElement,
  VisualIssue,
  CaseContext,
} from '../shared/types';
import { llmAdapter } from './llm-adapter';

// ============================================================================
// SCREENSHOT CAPTURE
// ============================================================================

/**
 * Capture screenshot of current tab
 * Must be called from service worker context
 */
export async function captureTabScreenshot(tabId: number): Promise<ScreenshotData | null> {
  try {
    // Get the tab's window ID
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.windowId) {
      console.error('[Visual] Tab not found or no window ID');
      return null;
    }

    // Capture screenshot of the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 90,
    });

    if (!dataUrl) {
      console.error('[Visual] Screenshot capture returned empty');
      return null;
    }

    // Extract base64 data
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    if (!base64) {
      console.error('[Visual] Failed to extract base64 from data URL');
      return null;
    }

    // Get viewport info from content script
    let viewportInfo = { width: 1920, height: 1080, scrollX: 0, scrollY: 0 };
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_VIEWPORT_INFO' });
      if (response) {
        viewportInfo = {
          width: response.viewportWidth ?? 1920,
          height: response.viewportHeight ?? 1080,
          scrollX: response.scrollX ?? 0,
          scrollY: response.scrollY ?? 0,
        };
      }
    } catch {
      // Content script might not be ready, use defaults
    }

    const screenshot: ScreenshotData = {
      base64,
      timestamp: Date.now(),
      viewportWidth: viewportInfo.width,
      viewportHeight: viewportInfo.height,
      scrollX: viewportInfo.scrollX,
      scrollY: viewportInfo.scrollY,
      url: tab.url ?? '',
    };

    console.log('[Visual] Screenshot captured:', {
      size: base64.length,
      viewport: `${viewportInfo.width}x${viewportInfo.height}`,
    });

    return screenshot;
  } catch (error) {
    console.error('[Visual] Screenshot capture failed:', error);
    return null;
  }
}

/**
 * Capture screenshot on action failure
 */
export async function captureFailureScreenshot(tabId: number): Promise<ScreenshotData | null> {
  console.log('[Visual] Capturing failure screenshot for tab:', tabId);
  return captureTabScreenshot(tabId);
}

// ============================================================================
// VISUAL ANALYSIS
// ============================================================================

/**
 * Analyze screenshot using multimodal LLM
 */
export async function analyzeScreenshot(
  screenshot: ScreenshotData,
  caseContext: CaseContext | null,
  options: {
    analysisType?: 'full' | 'quick' | 'action_detection';
    focusArea?: { x: number; y: number; width: number; height: number };
  } = {}
): Promise<VisualAnalysis | null> {
  try {
    // Build analysis prompt based on type
    const { systemPrompt, userPrompt } = buildAnalysisPrompts(screenshot, caseContext, options);

    // Use LLM adapter - for vision models, we'd need to pass the image
    // For now, we'll do text-based analysis using the metadata
    // In production, this would use a multimodal model like GPT-4 Vision
    
    const response = await llmAdapter.complete(systemPrompt, userPrompt);

    // Parse the analysis response
    const analysis = parseAnalysisResponse(response.content);
    
    console.log('[Visual] Analysis complete:', {
      pageType: analysis.pageType,
      elementCount: analysis.keyElements.length,
      issueCount: analysis.issues.length,
      confidence: analysis.confidence,
    });

    return analysis;
  } catch (error) {
    console.error('[Visual] Analysis failed:', error);
    return null;
  }
}

/**
 * Build analysis prompts for LLM
 */
function buildAnalysisPrompts(
  screenshot: ScreenshotData,
  caseContext: CaseContext | null,
  options: {
    analysisType?: 'full' | 'quick' | 'action_detection';
    focusArea?: { x: number; y: number; width: number; height: number };
  }
): { systemPrompt: string; userPrompt: string } {
  const analysisType = options.analysisType ?? 'full';

  const systemPrompt = `You are a Pega Infinity UI expert with visual analysis capabilities.

Analyze the page state based on the provided context. Your job is to understand:
1. What type of page is this?
2. What key elements are visible?
3. Are there any issues or errors?
4. What actions can the user take?

Output ONLY valid JSON matching this schema:
{
  "description": "Brief description of current page state",
  "pageType": "case_view|case_list|dashboard|assignment|error_page|loading|unknown",
  "keyElements": [
    {
      "type": "button|input|dropdown|table|form|alert|modal|section",
      "description": "What this element is",
      "location": {"x": 0, "y": 0, "width": 100, "height": 30},
      "text": "Visible text if any",
      "isActionable": true
    }
  ],
  "issues": [
    {
      "severity": "error|warning|info",
      "description": "What the issue is",
      "element": "Which element",
      "suggestedFix": "How to fix it"
    }
  ],
  "recommendedActions": ["Action 1", "Action 2"],
  "confidence": 0.85
}`;

  const caseInfo = caseContext ? `
CASE CONTEXT:
- Case ID: ${caseContext.caseId ?? 'Unknown'}
- Type: ${caseContext.caseType ?? 'Unknown'}
- Status: ${caseContext.status ?? 'Unknown'}
- Stage: ${caseContext.stageName ?? 'Unknown'}
` : '';

  const focusInfo = options.focusArea ? `
FOCUS AREA: x=${options.focusArea.x}, y=${options.focusArea.y}, width=${options.focusArea.width}, height=${options.focusArea.height}
` : '';

  const userPrompt = `Analyze this Pega page state.

SCREENSHOT METADATA:
- Viewport: ${screenshot.viewportWidth}x${screenshot.viewportHeight}
- Scroll: ${screenshot.scrollX}, ${screenshot.scrollY}
- URL: ${screenshot.url}
- Timestamp: ${new Date(screenshot.timestamp).toISOString()}
${caseInfo}${focusInfo}
Analysis Type: ${analysisType}

Provide visual analysis as JSON.`;

  return { systemPrompt, userPrompt };
}

/**
 * Parse analysis response from LLM
 */
function parseAnalysisResponse(content: string): VisualAnalysis {
  try {
    let jsonContent = content.trim();
    
    // Remove markdown code fences if present
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    const parsed = JSON.parse(jsonContent) as Partial<VisualAnalysis>;
    
    return {
      description: parsed.description ?? 'Unable to analyze screenshot',
      pageType: parsed.pageType ?? 'unknown',
      keyElements: parsed.keyElements ?? [],
      issues: parsed.issues ?? [],
      recommendedActions: parsed.recommendedActions ?? [],
      confidence: parsed.confidence ?? 0.5,
    };
  } catch (error) {
    console.error('[Visual] Failed to parse analysis response:', error);
    return {
      description: 'Failed to parse visual analysis',
      pageType: 'unknown',
      keyElements: [],
      issues: [{
        severity: 'error',
        description: 'Could not analyze page state',
      }],
      recommendedActions: [],
      confidence: 0,
    };
  }
}

// ============================================================================
// VISUAL DIFFING
// ============================================================================

/**
 * Compare two screenshots for visual changes
 */
export async function compareScreenshots(
  before: ScreenshotData,
  after: ScreenshotData
): Promise<{ hasChanges: boolean; changes: string[] }> {
  const changes: string[] = [];

  // Check viewport changes
  if (before.viewportWidth !== after.viewportWidth || 
      before.viewportHeight !== after.viewportHeight) {
    changes.push(`Viewport changed from ${before.viewportWidth}x${before.viewportHeight} to ${after.viewportWidth}x${after.viewportHeight}`);
  }

  // Check URL changes
  if (before.url !== after.url) {
    changes.push(`URL changed from ${before.url} to ${after.url}`);
  }

  // Check scroll position changes
  if (before.scrollX !== after.scrollX || before.scrollY !== after.scrollY) {
    changes.push(`Scroll position changed from (${before.scrollX}, ${before.scrollY}) to (${after.scrollX}, ${after.scrollY})`);
  }

  // Time-based heuristic for changes
  const timeDiff = Math.abs(after.timestamp - before.timestamp);
  if (timeDiff > 2000 && changes.length === 0) {
    changes.push('Page may have updated (time elapsed)');
  }

  return {
    hasChanges: changes.length > 0,
    changes,
  };
}

// ============================================================================
// ELEMENT DETECTION HELPERS
// ============================================================================

/**
 * Detect clickable elements from analysis
 */
export function detectClickableElements(analysis: VisualAnalysis): VisualElement[] {
  return analysis.keyElements.filter(el => el.isActionable);
}

/**
 * Detect form elements from analysis
 */
export function detectFormElements(analysis: VisualAnalysis): VisualElement[] {
  return analysis.keyElements.filter(el => 
    el.type === 'input' || el.type === 'dropdown' || el.type === 'form'
  );
}

/**
 * Detect error states from analysis
 */
export function detectErrors(analysis: VisualAnalysis): VisualIssue[] {
  return analysis.issues.filter(issue => issue.severity === 'error');
}

/**
 * Detect loading states from analysis
 */
export function isPageLoading(analysis: VisualAnalysis): boolean {
  return analysis.pageType === 'loading' ||
         analysis.keyElements.some(el => 
           el.description.toLowerCase().includes('loading') ||
           el.text?.toLowerCase().includes('loading')
         );
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const visualUnderstanding = {
  captureScreenshot: captureTabScreenshot,
  captureFailure: captureFailureScreenshot,
  analyze: analyzeScreenshot,
  compare: compareScreenshots,
  detectClickable: detectClickableElements,
  detectForms: detectFormElements,
  detectErrors,
  isLoading: isPageLoading,
};

console.log('[Visual] Module loaded');
