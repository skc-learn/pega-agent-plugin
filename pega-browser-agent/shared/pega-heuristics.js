/**
 * Pega Heuristics - Domain Knowledge for Pega Infinity
 *
 * Encodes Pega-specific patterns for:
 * - Field PII classification
 * - Case class domain identification
 * - Action button semantic classification
 * - Pega UI framework detection
 */

import { PIICategory } from './message-types.js';

/**
 * Field PII patterns - Used by PII masker
 * Format: [pattern, category]
 */
export const FIELD_PII_PATTERNS = [
  // Name patterns
  [/first.?name|fname|given.?name/i, PIICategory.NAME],
  [/last.?name|lname|surname/i, PIICategory.NAME],
  [/full.?name|customer.?name|client.?name|member.?name/i, PIICategory.NAME],
  [/contact.?name|applicant.?name|insured.?name/i, PIICategory.NAME],

  // SSN/Tax ID patterns
  [/ssn|social.?security|tax.?id|tin/i, PIICategory.SSN],
  [/national.?id|government.?id|ein/i, PIICategory.SSN],

  // Date of birth patterns
  [/date.?of.?birth|dob|birth.?date/i, PIICategory.DOB],
  [/birthday|born.?on/i, PIICategory.DOB],

  // Email patterns
  [/email|e-mail|email.?address/i, PIICategory.EMAIL],

  // Phone patterns
  [/phone|mobile|cell|telephone|contact.?number/i, PIICategory.PHONE],
  [/fax|fax.?number/i, PIICategory.PHONE],

  // Account patterns
  [/account.?num|acct.?num|account.?id/i, PIICategory.ACCOUNT],
  [/card.?num|credit.?card|debit.?card/i, PIICategory.ACCOUNT],
  [/policy.?num|claim.?num|loan.?num/i, PIICategory.ACCOUNT],

  // Address patterns
  [/address|street|city|state|zip|postal/i, PIICategory.ADDRESS],
  [/location|residence|mailing/i, PIICategory.ADDRESS],
];

/**
 * Case class domain patterns
 * Maps case class patterns to business domains
 */
export const CASE_DOMAIN_PATTERNS = {
  'financial-lending': [
    /LoanRequest|MortgageApp|CreditApp|LoanApplication/i,
    /MortgageProcessing|CreditDecision/i,
  ],
  'insurance-claims': [
    /Claim|ClaimProcessing|InsuranceClaim|FNOL/i,
    /ClaimAdjustment|ClaimApproval/i,
  ],
  'service-management': [
    /ServiceRequest|SvcReq|Incident|Ticket/i,
    /ServiceOrder|WorkOrder|ChangeRequest/i,
  ],
  'complaint-handling': [
    /CustomerComplaint|Complaint|Grievance/i,
    /DisputeResolution|Escalation/i,
  ],
  'hr-onboarding': [
    /Onboarding|EmployeeOnboard|NewHire/i,
    /Offboarding|Termination|Transfer/i,
  ],
  'healthcare': [
    /PatientCase|MedicalRecord|Treatment/i,
    /Authorization|Referral|PreAuth/i,
  ],
};

/**
 * Action button semantic classification
 * Maps button text/label patterns to action types
 */
export const ACTION_BUTTON_PATTERNS = {
  submit: [
    /submit|complete|finish|approve|close.?case/i,
    /finalize|confirm|send/i,
  ],
  save: [
    /save|update|apply.?changes|save.?changes/i,
    /save.?draft|save.?and.?continue/i,
  ],
  next: [
    /next|continue|proceed|go.?to.?next/i,
  ],
  cancel: [
    /cancel|discard|close|reject|abort/i,
    /back|previous|return/i,
  ],
  route: [
    /escalat|transfer|assign|route|reassign/i,
    /delegate|forward|handoff/i,
  ],
  create: [
    /create|new|add|start/i,
    /open.?case|begin/i,
  ],
  delete: [
    /delete|remove|withdraw/i,
  ],
};

/**
 * Pega UI root selectors
 * Used to detect Pega framework type
 */
export const PEGA_ROOT_SELECTORS = {
  constellation: [
    '#pega-ui-root',
    '[data-pega-app]',
    '.pega-constellation-root',
  ],
  classic: [
    '.pega-ui-form',
    '.harness-body',
    '#pegaui',
    '[data-ui-engine="cosmos"]',
  ],
};

/**
 * Pega meta tag patterns
 */
export const PEGA_META_PATTERNS = {
  application: /pega-application/i,
  version: /pega-version/i,
  framework: /pega-framework/i,
};

/**
 * Pega URL patterns for case detection
 */
export const PEGA_URL_PATTERNS = {
  caseId: /\/case\/([A-Z]+-\d+)/i,
  caseIdAlt: /\/cases\/([A-Z]+-\d+)/i,
  workObject: /WORK-\w+-\d+/i,
  portal: /\/portal\/\w+/i,
};

/**
 * Pega data attribute patterns
 */
export const PEGA_DATA_ATTRIBUTES = {
  testId: 'data-test-id',
  caseId: 'data-case-id',
  caseStatus: 'data-case-status',
  stage: 'data-stage',
  flowAction: 'data-flow-action',
  assignmentId: 'data-assignment-id',
};

/**
 * Common Pega test ID prefixes
 */
export const PEGA_TEST_ID_PREFIXES = {
  field: 'Field_',
  action: 'Action_',
  button: 'Button_',
  section: 'Section_',
  caseType: 'CaseType_',
  status: 'Status_',
  stage: 'Stage_',
};

/**
 * Field label inference priority
 * Order of attempts to find a field's label
 */
export const LABEL_INFERENCE_PRIORITY = [
  'aria-label',
  'for-attribute',
  'data-label',
  'prev-sibling',
  'parent-label',
  'placeholder',
  'testid-split',
];

/**
 * Stage type classification
 */
export const STAGE_TYPES = {
  INITIAL: 'initial',
  ACTIVE: 'active',
  PENDING: 'pending',
  TERMINAL: 'terminal',
  EXCEPTION: 'exception',
};

/**
 * Detect case domain from case class or type
 * @param {string} caseClass - Case class or type name
 * @returns {string|null} - Domain identifier
 */
export function detectCaseDomain(caseClass) {
  if (!caseClass) return null;

  for (const [domain, patterns] of Object.entries(CASE_DOMAIN_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(caseClass)) {
        return domain;
      }
    }
  }
  return null;
}

/**
 * Classify action button type from text
 * @param {string} buttonText - Button text or aria-label
 * @returns {string} - Action type
 */
export function classifyActionButton(buttonText) {
  if (!buttonText) return 'generic';

  const text = buttonText.toLowerCase();

  for (const [actionType, patterns] of Object.entries(ACTION_BUTTON_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return actionType;
      }
    }
  }
  return 'generic';
}

/**
 * Extract case ID from URL
 * @param {string} url - Page URL
 * @returns {string|null} - Case ID
 */
export function extractCaseIdFromUrl(url) {
  if (!url) return null;

  // Try /case/WORK-TYPE-12345 pattern
  const caseMatch = url.match(PEGA_URL_PATTERNS.caseId);
  if (caseMatch) return caseMatch[1];

  // Try /cases/WORK-TYPE-12345 pattern
  const caseAltMatch = url.match(PEGA_URL_PATTERNS.caseIdAlt);
  if (caseAltMatch) return caseAltMatch[1];

  // Try general WORK-OBJECT pattern anywhere in URL
  const workMatch = url.match(PEGA_URL_PATTERNS.workObject);
  if (workMatch) return workMatch[0];

  return null;
}

/**
 * Infer field label using priority methods
 * @param {HTMLElement} element - Form field element
 * @param {string} testId - Field's data-test-id
 * @returns {string} - Inferred label
 */
export function inferFieldLabel(element, testId) {
  // 1. Try aria-label
  if (element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label');
  }

  // 2. Try for attribute (label with for=id)
  const id = element.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.textContent.trim();
  }

  // 3. Try data-label attribute
  if (element.dataset.label) {
    return element.dataset.label;
  }

  // 4. Try previous sibling
  const prevSibling = element.previousElementSibling;
  if (prevSibling && prevSibling.tagName === 'LABEL') {
    return prevSibling.textContent.trim();
  }

  // 5. Try parent label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    // Get label text that's not the input itself
    const labelText = Array.from(parentLabel.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .join(' ')
      .trim();
    if (labelText) return labelText;
  }

  // 6. Try placeholder
  if (element.placeholder) {
    return element.placeholder;
  }

  // 7. Split testId
  if (testId) {
    // Convert "Field_FirstName" or "FirstName" to "First Name"
    const parts = testId.replace(/^(Field_|Button_|Action_)/i, '').split(/(?=[A-Z])/);
    return parts.join(' ').trim();
  }

  return '';
}

/**
 * Check if action requires confirmation
 * @param {string} actionType - Action type
 * @returns {boolean}
 */
export function requiresConfirmation(actionType) {
  const confirmationRequired = ['submit', 'delete', 'route'];
  return confirmationRequired.includes(actionType);
}

export default {
  FIELD_PII_PATTERNS,
  CASE_DOMAIN_PATTERNS,
  ACTION_BUTTON_PATTERNS,
  PEGA_ROOT_SELECTORS,
  PEGA_META_PATTERNS,
  PEGA_URL_PATTERNS,
  PEGA_DATA_ATTRIBUTES,
  PEGA_TEST_ID_PREFIXES,
  LABEL_INFERENCE_PRIORITY,
  STAGE_TYPES,
  detectCaseDomain,
  classifyActionButton,
  extractCaseIdFromUrl,
  inferFieldLabel,
  requiresConfirmation,
};
