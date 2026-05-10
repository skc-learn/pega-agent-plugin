/**
 * DOM Parser - Semantic DOM Extraction
 *
 * Extracts PII-masked semantic representation of current Pega UI.
 * Stable selectors, field extraction, case context, and actions.
 */

import type {
  DOMSnapshot,
  CaseContext,
  ParsedField,
  ParsedAction,
  FieldType,
} from '../shared/types';
import { piiMasker } from './pii-masker';
import {
  classifyField,
  classifyAction,
  extractCaseIdFromUrl,
  inferFieldLabel,
} from '../shared/pega-heuristics';

// ============================================================================
// FIELD TYPE DETECTION
// ============================================================================

function detectFieldType(element: HTMLElement): FieldType {
  const tagName = element.tagName.toLowerCase();
  const type = (element as HTMLInputElement).type?.toLowerCase() ?? '';

  if (tagName === 'select') return 'dropdown';
  if (tagName === 'textarea') return 'textarea';
  if (tagName === 'input') {
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'number') return 'number';
    if (type === 'date') return 'date';
    return 'text';
  }

  // Check for custom dropdown components
  if (
    element.getAttribute('role') === 'combobox' ||
    element.classList.contains('dropdown') ||
    element.classList.contains('select')
  ) {
    return 'dropdown';
  }

  return 'unknown';
}

/**
 * Detect Pega property type from element attributes
 */
function detectPegaPropertyType(element: HTMLElement): string | null {
  // Check for Pega-specific attributes
  const pegaType = element.getAttribute('data-property-type') ??
                  element.getAttribute('data-pega-type') ??
                  element.getAttribute('data-type');

  if (pegaType) {
    return pegaType;
  }

  // Infer from input type
  const inputType = (element as HTMLInputElement).type?.toLowerCase();
  if (inputType === 'date') return 'Date';
  if (inputType === 'number') return 'Number';
  if (inputType === 'email') return 'Email';
  if (inputType === 'tel') return 'Phone';
  if (inputType === 'url') return 'URL';

  // Check for currency patterns
  if (element.classList.contains('currency') ||
      element.hasAttribute('data-currency')) {
    return 'Currency';
  }

  // Check for percentage
  if (element.classList.contains('percentage') ||
      element.hasAttribute('data-percentage')) {
    return 'Percentage';
  }

  return null;
}

// ============================================================================
// SELECTOR GENERATION
// ============================================================================

/**
 * Build stable selector for an element
 * Priority: data-test-id > aria-based > path-based
 * Never use positional selectors - they break on Pega re-renders
 */
function buildSelector(element: HTMLElement): string {
  // Priority 1: data-test-id
  const testId = element.getAttribute('data-test-id');
  if (testId) {
    return `[data-test-id="${testId}"]`;
  }

  // Priority 2: aria-label with tag
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return `${element.tagName.toLowerCase()}[aria-label="${CSS.escape(ariaLabel)}"]`;
  }

  // Priority 3: id (if stable-looking)
  const id = element.id;
  if (id && !id.match(/^[a-z]{1,3}\d+$/i)) {
    // Avoid auto-generated IDs like "id123"
    return `#${CSS.escape(id)}`;
  }

  // Priority 4: name attribute
  const name = (element as HTMLInputElement).name;
  if (name) {
    return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  }

  // Fallback: Build semantic path (no positional)
  const path: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body) {
    let segment = current.tagName.toLowerCase();

    // Add semantic identifier if available
    const currentTestId = current.getAttribute('data-test-id');
    if (currentTestId) {
      segment = `[data-test-id="${currentTestId}"]`;
      path.unshift(segment);
      break;
    }

    const currentAria = current.getAttribute('aria-label');
    if (currentAria) {
      segment += `[aria-label="${CSS.escape(currentAria)}"]`;
    }

    path.unshift(segment);
    current = current.parentElement;
  }

  return path.join(' > ');
}

// ============================================================================
// FIELD EXTRACTION
// ============================================================================

/**
 * Extract all form fields from the DOM
 */
function extractFields(): ParsedField[] {
  const fields: ParsedField[] = [];
  const processedTestIds = new Set<string>();

  // First, try to extract Constellation label-value pairs
  // Pattern: data-test-id element as label, next sibling or nearby element as value
  const labelElements = document.querySelectorAll<HTMLElement>('[data-test-id]');
  for (const labelEl of labelElements) {
    const testId = labelEl.getAttribute('data-test-id');
    if (!testId || processedTestIds.has(testId)) continue;

    // Check if this looks like a label (short text, no input)
    const labelText = labelEl.textContent?.trim() ?? '';
    const isInputLabel = labelEl.tagName === 'INPUT' ||
                         labelEl.tagName === 'TEXTAREA' ||
                         labelEl.tagName === 'SELECT';

    if (!isInputLabel && labelText.length > 0 && labelText.length < 100) {
      // This might be a label - look for value in sibling or parent's next sibling
      const parent = labelEl.parentElement;
      let valueEl: HTMLElement | null = null;
      let value: string | null = null;

      // Try next sibling
      const nextSibling = labelEl.nextElementSibling as HTMLElement;
      if (nextSibling && nextSibling.textContent) {
        value = nextSibling.textContent.trim();
        valueEl = nextSibling;
      }

      // Try parent's next sibling (common in flex layouts)
      if (!value && parent) {
        const parentNext = parent.nextElementSibling as HTMLElement;
        if (parentNext?.textContent) {
          const parentNextText = parentNext.textContent.trim();
          if (parentNextText && parentNextText !== labelText) {
            value = parentNextText;
            valueEl = parentNext;
          }
        }
      }

      // Try looking for value in same parent container
      if (!value && parent) {
        const valueElements = parent.querySelectorAll<HTMLElement>('[class*="value"], [class*="Value"]');
        for (const ve of valueElements) {
          const v = ve.textContent?.trim();
          if (v && v !== labelText) {
            value = v;
            valueEl = ve;
            break;
          }
        }
      }

      if (value && value !== labelText) {
        processedTestIds.add(testId);

        // Classify PII and mask
        const { piiCategory, semantic, pegaPropertyType } = classifyField(labelText, testId);
        const maskedValue = piiMasker.mask(value, piiCategory);

        fields.push({
          testId,
          label: labelText,
          value: maskedValue,
          piiCategory,
          piiToken: maskedValue !== value ? maskedValue : null,
          fieldType: 'text',
          isEditable: false,
          isRequired: false,
          selector: valueEl ? buildSelector(valueEl) : buildSelector(labelEl),
          semantic,
          pegaPropertyType,
        });
      }
    }
  }

  // Also extract form inputs
  const inputSelectors = [
    'input[aria-label]',
    'textarea[aria-label]',
    'select[aria-label]',
    'input[name]',
    'textarea[name]',
    'select[name]',
    'input[id]',
    'textarea[id]',
    'select[id]',
  ];

  const inputElements = document.querySelectorAll<HTMLElement>(inputSelectors.join(', '));
  for (const element of inputElements) {
    const testId = element.getAttribute('data-test-id') ?? element.id ?? null;
    if (testId && processedTestIds.has(testId)) continue;

    const label = inferFieldLabel(element, testId);
    const value = (element as HTMLInputElement).value ?? null;

    if (!label && !value) continue;

    // Classify PII and mask
    const { piiCategory, semantic, pegaPropertyType: heuristicPegaType } = classifyField(label, testId);
    const maskedValue = piiMasker.mask(value, piiCategory);

    const fieldType = detectFieldType(element);
    const isEditable = !element.hasAttribute('disabled') &&
                         !element.hasAttribute('readonly') &&
                         (element as HTMLInputElement).type !== 'hidden';
    const isRequired = element.hasAttribute('required') ||
                         element.getAttribute('aria-required') === 'true';

    const pegaPropertyType = detectPegaPropertyType(element) ?? heuristicPegaType;

    if (testId) processedTestIds.add(testId);

    fields.push({
      testId,
      label,
      value: maskedValue,
      piiCategory,
      piiToken: maskedValue !== value ? maskedValue : null,
      fieldType,
      isEditable,
      isRequired,
      selector: buildSelector(element),
      semantic,
      pegaPropertyType,
    });
  }

  return fields;
}

// ============================================================================
// ACTION EXTRACTION
// ============================================================================

/**
 * Extract all action buttons from the DOM
 */
function extractActions(): ParsedAction[] {
  const actions: ParsedAction[] = [];

  // Query all button elements
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    'button[data-test-id], button[aria-label], button:not([disabled])'
  );

  for (const button of buttons) {
    const label = button.getAttribute('aria-label') ??
                  button.textContent?.trim() ??
                  '';
    const testId = button.getAttribute('data-test-id');

    // Get full action classification from heuristics
    const {
      actionType,
      requiresConfirmation,
      isFlowAction: heuristicFlowAction,
      isLocalAction: heuristicLocalAction,
      isBulkAction: heuristicBulkAction,
    } = classifyAction(label);

    const isDisabled = button.disabled ||
                       button.hasAttribute('disabled') ||
                       button.getAttribute('aria-disabled') === 'true';

    // Prefer DOM attributes for action flags, fallback to heuristics
    const isFlowAction = button.hasAttribute('data-flow-action') ||
                         button.classList.contains('flow-action') ||
                         heuristicFlowAction;
    const isLocalAction = button.hasAttribute('data-local-action') ||
                          button.classList.contains('local-action') ||
                          heuristicLocalAction;
    const isBulkAction = button.hasAttribute('data-bulk-action') ||
                         button.classList.contains('bulk-action') ||
                         heuristicBulkAction;

    actions.push({
      label,
      testId,
      selector: buildSelector(button),
      actionType,
      isDisabled,
      requiresConfirmation,
      isFlowAction,
      isLocalAction,
      isBulkAction,
    });
  }

  return actions;
}

// ============================================================================
// CASE CONTEXT EXTRACTION
// ============================================================================

/**
 * Extract case context from DOM and URL
 */
function extractCaseContext(): CaseContext {
  const url = window.location.href;

  // Case ID from URL or DOM
  let caseId = extractCaseIdFromUrl(url);
  if (!caseId) {
    const caseIdAttr = document.querySelector('[data-case-id]');
    caseId = caseIdAttr?.getAttribute('data-case-id') ?? null;
  }

  // Case class from form test ID
  let caseClass: string | null = null;
  const formElement = document.querySelector('[data-test-id$="-Form"]');
  if (formElement) {
    const formTestId = formElement.getAttribute('data-test-id');
    if (formTestId) {
      caseClass = formTestId.replace(/-Form$/, '');
    }
  }

  // Try URL path pattern for case class
  if (!caseClass) {
    const pathMatch = url.match(/\/([A-Z]+)-([A-Z]+)-\d+/i);
    if (pathMatch) {
      caseClass = `${pathMatch[1]}-${pathMatch[2]}`;
    }
  }

  // Status
  let status: string | null = null;
  const statusElement = document.querySelector(
    '[data-case-status], [data-test-id*="Status"]'
  );
  if (statusElement) {
    status = statusElement.getAttribute('data-case-status') ??
             statusElement.textContent?.trim() ?? null;
  }

  // Urgency/Priority
  let urgency: string | null = null;
  const urgencyElement = document.querySelector('[data-test-id*="Urgency"], [data-test-id*="Priority"]');
  if (urgencyElement) {
    urgency = urgencyElement.textContent?.trim() ?? null;
  }

  // SLA Deadline
  let slaDeadline: string | null = null;
  const slaElement = document.querySelector(
    '[data-test-id*="SLADeadline"], [data-test-id*="TargetDate"], [data-test-id*="SLA"]'
  );
  if (slaElement) {
    slaDeadline = slaElement.textContent?.trim() ?? null;
  }

  // Stage
  let stageName: string | null = null;
  const stageElement = document.querySelector(
    '[data-pega-stageid], [data-stage], .stage-active, .current-stage'
  );
  if (stageElement) {
    stageName = stageElement.getAttribute('data-pega-stageid') ??
                stageElement.getAttribute('data-stage') ??
                stageElement.textContent?.trim() ?? null;
  }

  // Assigned To
  let assignedTo: string | null = null;
  const assigneeElement = document.querySelector(
    '[data-test-id*="AssignedTo"], [data-test-id*="Assignee"]'
  );
  if (assigneeElement) {
    assignedTo = assigneeElement.textContent?.trim() ?? null;
  }

  // Domain detection
  let domain: string | null = null;
  const breadcrumb = document.querySelector('.breadcrumb, [data-test-id*="Breadcrumb"]');
  if (breadcrumb?.textContent) {
    // Could extract domain from breadcrumb
    domain = breadcrumb.textContent.trim().split(/[\/>]/)[0] ?? null;
  }

  return {
    caseId,
    caseClass,
    caseType: caseClass, // Often same as caseClass
    status,
    urgency,
    assignedTo,
    slaDeadline,
    stageName,
    domain,
  };
}

// ============================================================================
// PAGE METADATA
// ============================================================================

/**
 * Extract page title
 */
function extractPageTitle(): string {
  return document.title || document.querySelector('h1')?.textContent?.trim() || '';
}

/**
 * Extract breadcrumbs
 */
function extractBreadcrumbs(): string[] {
  const breadcrumbs: string[] = [];
  const breadcrumbElements = document.querySelectorAll(
    '.breadcrumb li, .breadcrumb span, [data-test-id*="Breadcrumb"] span, [data-test-id*="Breadcrumb"] a'
  );

  for (const element of breadcrumbElements) {
    const text = element.textContent?.trim();
    if (text) {
      breadcrumbs.push(text);
    }
  }

  return breadcrumbs;
}

// ============================================================================
// MAIN CAPTURE FUNCTION
// ============================================================================

/**
 * Capture a complete DOM snapshot
 */
export function captureDOM(triggerSummary: boolean = false): DOMSnapshot {
  return {
    timestamp: Date.now(),
    url: window.location.href,
    triggerSummary,
    caseContext: extractCaseContext(),
    fields: extractFields(),
    actions: extractActions(),
    pageTitle: extractPageTitle(),
    breadcrumbs: extractBreadcrumbs(),
  };
}
