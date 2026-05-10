/**
 * Pega Heuristics Tests
 *
 * Test expanded field patterns, action patterns, and functions
 */

import {
  classifyField,
  classifyAction,
  detectCaseDomain,
  getDomainMetadata,
  requiresLLM,
  isLocalIntent,
  getSupportedIntents,
  parseWorkObjectId,
  parseSLAInterval,
  isValidDataPageName,
  parseDataPageName,
  extractCaseIdFromUrl,
  getUrgencyLevel,
} from '../../src/shared/pega-heuristics';

import type { IntentType, ActionType } from '../../src/shared/types';

describe('Field Classification', () => {
  const testCases: Array<{
    label: string;
    expectedPiiCategory: string | null;
    expectedSemantic: string | null;
    expectedPegaPropertyType: string | null;
  }> = [
    // Name fields
    { label: 'First Name', expectedPiiCategory: 'NAME', expectedSemantic: 'person.firstName', expectedPegaPropertyType: 'Text' },
    { label: 'Last Name', expectedPiiCategory: 'NAME', expectedSemantic: 'person.lastName', expectedPegaPropertyType: 'Text' },
    { label: 'Email Address', expectedPiiCategory: 'EMAIL', expectedSemantic: 'contact.email', expectedPegaPropertyType: 'Text' },
    { label: 'Phone Number', expectedPiiCategory: 'PHONE', expectedSemantic: 'contact.phone', expectedPegaPropertyType: 'PhoneNumber' },
    { label: 'Date of Birth', expectedPiiCategory: 'DOB', expectedSemantic: 'person.dob', expectedPegaPropertyType: 'Date' },
    { label: 'Social Security Number', expectedPiiCategory: 'SSN', expectedSemantic: 'person.ssn', expectedPegaPropertyType: 'Text' },
    { label: 'Account Number', expectedPiiCategory: 'ACCOUNT', expectedSemantic: 'financial.accountNumber', expectedPegaPropertyType: 'Text' },
    { label: 'Street Address', expectedPiiCategory: 'ADDRESS', expectedSemantic: 'location.streetAddress', expectedPegaPropertyType: 'Text' },
    { label: 'Annual Income', expectedPiiCategory: 'INCOME', expectedSemantic: 'financial.income', expectedPegaPropertyType: 'Currency' },
    { label: 'Loan Amount', expectedPiiCategory: null, expectedSemantic: 'financial.amount', expectedPegaPropertyType: 'Currency' },
    { label: 'Case Status', expectedPiiCategory: null, expectedSemantic: 'case.status', expectedPegaPropertyType: 'Text' },
    { label: 'Priority Level', expectedPiiCategory: null, expectedSemantic: 'case.priority', expectedPegaPropertyType: 'Text' },
    // Healthcare fields
    { label: 'Medical Record Number', expectedPiiCategory: 'ACCOUNT', expectedSemantic: 'healthcare.medicalRecordNumber', expectedPegaPropertyType: 'Text' },
    { label: 'Diagnosis Code', expectedPiiCategory: null, expectedSemantic: 'healthcare.diagnosisCode', expectedPegaPropertyType: 'Text' },
    { label: 'NPI Number', expectedPiiCategory: 'SSN', expectedSemantic: 'healthcare.npi', expectedPegaPropertyType: 'Text' },
    { label: 'Member ID', expectedPiiCategory: 'ACCOUNT', expectedSemantic: 'healthcare.memberId', expectedPegaPropertyType: 'Text' },
    { label: 'Service Date', expectedPiiCategory: null, expectedSemantic: 'healthcare.serviceDate', expectedPegaPropertyType: 'Date' },
    // Government fields
    { label: 'Benefit Type', expectedPiiCategory: null, expectedSemantic: 'government.benefitType', expectedPegaPropertyType: 'Text' },
    { label: 'Household Size', expectedPiiCategory: null, expectedSemantic: 'government.householdSize', expectedPegaPropertyType: 'Integer' },
    // Insurance fields
    { label: 'Policy Number', expectedPiiCategory: 'ACCOUNT', expectedSemantic: 'financial.policyNumber', expectedPegaPropertyType: 'Text' },
    { label: 'Claim Number', expectedPiiCategory: 'ACCOUNT', expectedSemantic: 'financial.claimNumber', expectedPegaPropertyType: 'Text' },
    { label: 'Loss Date', expectedPiiCategory: null, expectedSemantic: 'insurance.lossDate', expectedPegaPropertyType: 'Date' },
    // Edge cases
    { label: 'random text', expectedPiiCategory: null, expectedSemantic: null, expectedPegaPropertyType: null },
    { label: '123 Main St', expectedPiiCategory: null, expectedSemantic: null, expectedPegaPropertyType: null },
  ];

  testCases.forEach(({ label, expectedPiiCategory, expectedSemantic, expectedPegaPropertyType }) => {
    it(`should classify "${label}" correctly`, () => {
      const result = classifyField(label, null);
      expect(result.piiCategory).toBe(expectedPiiCategory);
      expect(result.semantic).toBe(expectedSemantic);
      expect(result.pegaPropertyType).toBe(expectedPegaPropertyType);
    });
  });
});

describe('Action Classification', () => {
  const testCases: Array<{
    buttonText: string;
    expectedActionType: ActionType;
    expectedRequiresConfirmation: boolean;
    expectedIsFlowAction: boolean;
    expectedIsLocalAction: boolean;
    expectedIsBulkAction: boolean;
  }> = [
    // Primary actions
    { buttonText: 'Submit', expectedActionType: 'submit', expectedRequiresConfirmation: true, expectedIsFlowAction: true, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Complete', expectedActionType: 'submit', expectedRequiresConfirmation: true, expectedIsFlowAction: true, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Approve', expectedActionType: 'submit', expectedRequiresConfirmation: true, expectedIsFlowAction: true, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Save', expectedActionType: 'save', expectedRequiresConfirmation: false, expectedIsFlowAction: false, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Save Draft', expectedActionType: 'save', expectedRequiresConfirmation: false, expectedIsFlowAction: false, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Next', expectedActionType: 'next', expectedRequiresConfirmation: false, expectedIsFlowAction: true, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Continue', expectedActionType: 'next', expectedRequiresConfirmation: false, expectedIsFlowAction: true, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Cancel', expectedActionType: 'cancel', expectedRequiresConfirmation: true, expectedIsFlowAction: true, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Reject', expectedActionType: 'cancel', expectedRequiresConfirmation: true, expectedIsFlowAction: true, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Escalate', expectedActionType: 'escalate', expectedRequiresConfirmation: true, expectedIsFlowAction: true, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Transfer', expectedActionType: 'escalate', expectedRequiresConfirmation: true, expectedIsFlowAction: true, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Assign', expectedActionType: 'assign', expectedRequiresConfirmation: true, expectedIsFlowAction: false, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Reassign', expectedActionType: 'assign', expectedRequiresConfirmation: true, expectedIsFlowAction: false, expectedIsLocalAction: false, expectedIsBulkAction: false },
    { buttonText: 'Add Note', expectedActionType: 'generic', expectedRequiresConfirmation: false, expectedIsFlowAction: false, expectedIsLocalAction: true, expectedIsBulkAction: false },
    { buttonText: 'Add Attachment', expectedActionType: 'generic', expectedRequiresConfirmation: false, expectedIsFlowAction: false, expectedIsLocalAction: true, expectedIsBulkAction: false },
    { buttonText: 'Print', expectedActionType: 'generic', expectedRequiresConfirmation: false, expectedIsFlowAction: false, expectedIsLocalAction: true, expectedIsBulkAction: false },
    { buttonText: 'Bulk Update', expectedActionType: 'generic', expectedRequiresConfirmation: true, expectedIsFlowAction: false, expectedIsLocalAction: false, expectedIsBulkAction: true },
    { buttonText: 'Delete', expectedActionType: 'cancel', expectedRequiresConfirmation: true, expectedIsFlowAction: false, expectedIsLocalAction: false, expectedIsBulkAction: false },
  ];

  testCases.forEach(({ buttonText, expectedActionType, expectedRequiresConfirmation, expectedIsFlowAction, expectedIsLocalAction, expectedIsBulkAction }) => {
    it(`should classify "${buttonText}" action correctly`, () => {
      const result = classifyAction(buttonText);
      expect(result.actionType).toBe(expectedActionType);
      expect(result.requiresConfirmation).toBe(expectedRequiresConfirmation);
      expect(result.isFlowAction).toBe(expectedIsFlowAction);
      expect(result.isLocalAction).toBe(expectedIsLocalAction);
      expect(result.isBulkAction).toBe(expectedIsBulkAction);
    });
  });
});

describe('Domain Detection', () => {
  const testCases: Array<{
    caseClass: string;
    expectedDomain: string;
  }> = [
    // Financial Services
    { caseClass: 'LoanRequest-1234', expectedDomain: 'financial-lending' },
    { caseClass: 'MortgageApplication-456', expectedDomain: 'financial-lending' },
    { caseClass: 'CreditApp-789', expectedDomain: 'financial-lending' },
    { caseClass: 'InsuranceClaim-1234', expectedDomain: 'insurance-claims' },
    { caseClass: 'ClaimProcessing-5678', expectedDomain: 'insurance-claims' },
    { caseClass: 'FNOL-1234', expectedDomain: 'insurance-claims' },
    // Healthcare
    { caseClass: 'PatientCase-1234', expectedDomain: 'healthcare-patient' },
    { caseClass: 'MedicalRecord-1234', expectedDomain: 'healthcare-patient' },
    { caseClass: 'PreAuth-1234', expectedDomain: 'healthcare-patient' },
    // Government
    { caseClass: 'BenefitApplication-1234', expectedDomain: 'government-benefits' },
    { caseClass: 'TaxReturn-1234', expectedDomain: 'tax-processing' },
    // Service Management
    { caseClass: 'ServiceRequest-1234', expectedDomain: 'service-management' },
    { caseClass: 'Incident-1234', expectedDomain: 'service-management' },
    { caseClass: 'ChangeRequest-1234', expectedDomain: 'service-management' },
    // HR
    { caseClass: 'EmployeeOnboarding-1234', expectedDomain: 'hr-onboarding' },
    { caseClass: 'LeaveRequest-1234', expectedDomain: 'hr-service' },
    // Procurement
    { caseClass: 'PurchaseRequest-1234', expectedDomain: 'procurement' },
    { caseClass: 'PurchaseOrder-1234', expectedDomain: 'procurement' },
    // Unknown
    { caseClass: 'UnknownCase-1234', expectedDomain: null },
    { caseClass: 'RandomClass-1234', expectedDomain: null },
  ];

  testCases.forEach(({ caseClass, expectedDomain }) => {
    it(`should detect domain for "${caseClass}"`, () => {
      const result = detectCaseDomain(caseClass);
      expect(result).toBe(expectedDomain);
    });
  });
});

describe('Domain Metadata', () => {
  const testCases: Array<{
    domain: string;
    expectedMetadata: {
      industry: string;
      subIndustry: string;
      typicalStages: string[];
      commonActors: string[];
      riskFactors: string[];
    };
  }> = [
    {
      domain: 'financial-lending',
      expectedMetadata: {
        industry: 'Financial Services',
        subIndustry: 'Lending',
        typicalStages: ['Application', 'Document Collection', 'Underwriting', 'Decision', 'Funding', 'Servicing'],
        commonActors: ['Loan Officer', 'Underwriter', 'Processor', 'Closer', 'Applicant'],
        riskFactors: ['Credit Risk', 'Fraud Risk', 'Compliance Risk', 'Interest Rate Risk'],
      },
    },
    {
      domain: 'insurance-claims',
      expectedMetadata: {
        industry: 'Insurance',
        subIndustry: 'Claims',
        typicalStages: ['FNOL', 'Investigation', 'Evaluation', 'Resolution', 'Payment', 'Recovery'],
        commonActors: ['Claims Adjuster', 'Examiner', 'Appraiser', 'Claimant', 'Agent'],
        riskFactors: ['Fraud Risk', 'Reserve Risk', 'Litigation Risk', 'SLA Breach'],
      },
    },
    {
      domain: 'healthcare-patient',
      expectedMetadata: {
        industry: 'Healthcare',
        subIndustry: 'Patient Care',
        typicalStages: ['Intake', 'Assessment', 'Treatment Planning', 'Care Delivery', 'Follow-up', 'Discharge'],
        commonActors: ['Physician', 'Nurse', 'Care Coordinator', 'Patient', 'Specialist'],
        riskFactors: ['Patient Safety', 'Compliance (HIPAA)', 'Quality of Care', 'Readmission Risk'],
      },
    },
  ];

  testCases.forEach(({ domain, expectedMetadata }) => {
    it(`should return correct metadata for "${domain}"`, () => {
      const result = getDomainMetadata(domain);
      expect(result).toEqual(expectedMetadata);
    });
  });
});

describe('Work Object ID Parsing', () => {
  const testCases: Array<{
    input: string;
    expectedPrefix: string | null;
    expectedId: string | null;
    expectedValid: boolean;
  }> = [
    { input: 'LOAN-1234', expectedPrefix: 'LOAN', expectedId: '1234', expectedValid: true },
    { input: 'ONB-5678', expectedPrefix: 'ONB', expectedId: '5678', expectedValid: true },
    { input: 'CLAIM-ABC123', expectedPrefix: 'CLAIM', expectedId: 'ABC123', expectedValid: true },
    { input: 'C-1234', expectedPrefix: null, expectedId: null, expectedValid: false },
    { input: 'invalid', expectedPrefix: null, expectedId: null, expectedValid: false },
    { input: '', expectedPrefix: null, expectedId: null, expectedValid: false },
  ];

  testCases.forEach(({ input, expectedPrefix, expectedId, expectedValid }) => {
    it(`should parse "${input}" correctly`, () => {
      const result = parseWorkObjectId(input);
      expect(result.prefix).toBe(expectedPrefix);
      expect(result.id).toBe(expectedId);
      expect(result.valid).toBe(expectedValid);
    });
  });
});

describe('SLA Interval Parsing', () => {
  const testCases: Array<{
    input: string;
    expectedDays: number;
    expectedHours: number;
    expectedMinutes: number;
    expectedTotalMinutes: number;
  }> = [
    { input: '2 days', expectedDays: 2, expectedHours: 0, expectedMinutes: 0, expectedTotalMinutes: 2880 },
    { input: '5 hours', expectedDays: 0, expectedHours: 5, expectedMinutes: 0, expectedTotalMinutes: 300 },
    { input: '30 minutes', expectedDays: 0, expectedHours: 0, expectedMinutes: 30, expectedTotalMinutes: 30 },
    { input: '1 day 2 hours', expectedDays: 1, expectedHours: 2, expectedMinutes: 0, expectedTotalMinutes: 1560 },
    { input: '3 days 4 hours 15 minutes', expectedDays: 3, expectedHours: 4, expectedMinutes: 15, expectedTotalMinutes: 4655 },
    { input: 'invalid', expectedDays: 0, expectedHours: 0, expectedMinutes: 0, expectedTotalMinutes: 0 },
    { input: '', expectedDays: 0, expectedHours: 0, expectedMinutes: 0, expectedTotalMinutes: 0 },
  ];

  testCases.forEach(({ input, expectedDays, expectedHours, expectedMinutes, expectedTotalMinutes }) => {
    it(`should parse "${input}" correctly`, () => {
      const result = parseSLAInterval(input);
      expect(result.days).toBe(expectedDays);
      expect(result.hours).toBe(expectedHours);
      expect(result.minutes).toBe(expectedMinutes);
      expect(result.totalMinutes).toBe(expectedTotalMinutes);
    });
  });
});

describe('Data Page Validation', () => {
  const validCases = [
    'D_CustomerList',
    'D_Accounts',
    'D_ProductData',
    'D_UserProfile',
  ];

  const invalidCases = [
    'CustomerList',
    'd_customerlist',
    'Data_Customer',
    'Customer',
    '',
  ];

  validCases.forEach((name) => {
    it(`should validate "${name}" as valid`, () => {
      expect(isValidDataPageName(name)).toBe(true);
    });
  });

  invalidCases.forEach((name) => {
    it(`should validate "${name}" as invalid`, () => {
      expect(isValidDataPageName(name)).toBe(false);
    });
  });
});

describe('Data Page Name Parsing', () => {
  const testCases: Array<{
    input: string;
    expectedValid: boolean;
    expectedName: string | null;
  }> = [
    { input: 'D_CustomerList', expectedValid: true, expectedName: 'CustomerList' },
    { input: 'D_Accounts', expectedValid: true, expectedName: 'Accounts' },
    { input: 'InvalidName', expectedValid: false, expectedName: null },
  ];

  testCases.forEach(({ input, expectedValid, expectedName }) => {
    it(`should parse "${input}" correctly`, () => {
      const result = parseDataPageName(input);
      expect(result.valid).toBe(expectedValid);
      expect(result.name).toBe(expectedName);
    });
  });
});

describe('Case ID URL Extraction', () => {
  const testCases: Array<{
    url: string;
    expectedCaseId: string | null;
  }> = [
    { url: 'https://app.pega.com/prweb/app/case/LOAN-1234', expectedCaseId: 'LOAN-1234' },
    { url: 'https://app.pega.com/cases/CLAIM-5678/view', expectedCaseId: 'CLAIM-5678' },
    { url: 'https://app.pega.com/work/ONB-ABC123', expectedCaseId: 'ONB-ABC123' },
    { url: 'https://app.pega.com/dashboard', expectedCaseId: null },
    { url: '', expectedCaseId: null },
  ];

  testCases.forEach(({ url, expectedCaseId }) => {
    it(`should extract case ID from "${url}"`, () => {
      const result = extractCaseIdFromUrl(url);
      expect(result).toBe(expectedCaseId);
    });
  });
});

describe('Urgency Level Detection', () => {
  const testCases: Array<{
    urgency: number;
    expectedLevel: string;
  }> = [
    { urgency: 10, expectedLevel: 'Low' },
    { urgency: 30, expectedLevel: 'Low' },
    { urgency: 50, expectedLevel: 'Medium' },
    { urgency: 70, expectedLevel: 'High' },
    { urgency: 85, expectedLevel: 'Critical' },
    { urgency: 100, expectedLevel: 'Critical' },
  ];

  testCases.forEach(({ urgency, expectedLevel }) => {
    it(`should classify urgency ${urgency} as "${expectedLevel}"`, () => {
      const result = getUrgencyLevel(urgency);
      expect(result).toBe(expectedLevel);
    });
  });
});

describe('requiresLLM Function', () => {
  const localIntents: IntentType[] = ['SAVE_CASE', 'SUBMIT_CASE', 'NEXT_STEP'];
  const llmIntents: IntentType[] = ['SUMMARIZE_CASE', 'UPDATE_FIELD', 'ESCALATE', 'CREATE_CASE', 'SEARCH', 'EXPLAIN'];

  localIntents.forEach((intent) => {
    it(`should return false for ${intent} (local)`, () => {
      expect(requiresLLM(intent)).toBe(false);
    });
  });

  llmIntents.forEach((intent) => {
    it(`should return true for ${intent} (requires LLM)`, () => {
      expect(requiresLLM(intent)).toBe(true);
    });
  });
});

describe('isLocalIntent Function', () => {
  it('should return true for local intents', () => {
    expect(isLocalIntent('SAVE_CASE')).toBe(true);
    expect(isLocalIntent('SUBMIT_CASE')).toBe(true);
    expect(isLocalIntent('NEXT_STEP')).toBe(true);
  });

  it('should return false for LLM-required intents', () => {
    expect(isLocalIntent('SUMMARIZE_CASE')).toBe(false);
    expect(isLocalIntent('UPDATE_FIELD')).toBe(false);
    expect(isLocalIntent('SEARCH')).toBe(false);
  });
});

describe('getSupportedIntents Function', () => {
  it('should return array of supported intents', () => {
    const intents = getSupportedIntents();
    expect(Array.isArray(intents)).toBe(true);
    expect(intents.length).toBeGreaterThan(0);
    expect(intents).toContain('SUMMARIZE_CASE');
    expect(intents).toContain('UPDATE_FIELD');
    expect(intents).toContain('SUBMIT_CASE');
  });
});

