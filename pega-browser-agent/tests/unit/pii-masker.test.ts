/**
 * PII Masker Tests
 *
 * Test all 8 PII categories with realistic Pega field label samples.
 */

import { PIIMasker } from '../../src/content-scripts/pii-masker';
import type { PiiCategory } from '../../src/shared/types';

describe('PIIMasker', () => {
  let masker: PIIMasker;

  beforeEach(() => {
    masker = new PIIMasker();
  });

  afterEach(() => {
    masker.clearSession();
  });

  describe('classify', () => {
    const testCases: Array<{
      label: string;
      testId: string;
      expected: PiiCategory;
    }> = [
      // NAME patterns
      { label: 'Customer First Name', testId: 'Field_FirstName', expected: 'NAME' },
      { label: 'Last Name', testId: 'Field_LastName', expected: 'NAME' },
      { label: 'Full Name', testId: 'Field_CustomerName', expected: 'NAME' },
      { label: 'Applicant Name', testId: 'Field_ApplicantName', expected: 'NAME' },
      { label: 'Given Name', testId: 'Field_GivenName', expected: 'NAME' },
      { label: 'Surname', testId: 'Field_Surname', expected: 'NAME' },
      { label: 'Contact Name', testId: 'Field_ContactName', expected: 'NAME' },
      { label: 'Insured Name', testId: 'Field_InsuredName', expected: 'NAME' },
      { label: 'fname', testId: 'fname', expected: 'NAME' },
      { label: 'lname', testId: 'lname', expected: 'NAME' },

      // SSN patterns
      { label: 'Social Security Number', testId: 'Field_SSN', expected: 'SSN' },
      { label: 'SSN', testId: 'Field_SSN', expected: 'SSN' },
      { label: 'Tax ID', testId: 'Field_TaxID', expected: 'SSN' },
      { label: 'TIN', testId: 'Field_TIN', expected: 'SSN' },
      { label: 'National ID', testId: 'Field_NationalID', expected: 'SSN' },
      { label: 'Government ID', testId: 'Field_GovernmentID', expected: 'SSN' },
      { label: 'EIN', testId: 'Field_EIN', expected: 'SSN' },

      // DOB patterns
      { label: 'Date of Birth', testId: 'Field_DOB', expected: 'DOB' },
      { label: 'DOB', testId: 'Field_DOB', expected: 'DOB' },
      { label: 'Birth Date', testId: 'Field_BirthDate', expected: 'DOB' },
      { label: 'Birthday', testId: 'Field_Birthday', expected: 'DOB' },
      { label: 'Born On', testId: 'Field_BornOn', expected: 'DOB' },

      // EMAIL patterns
      { label: 'Email', testId: 'Field_Email', expected: 'EMAIL' },
      { label: 'E-Mail Address', testId: 'Field_EmailAddress', expected: 'EMAIL' },
      { label: 'Email Address', testId: 'Field_Email', expected: 'EMAIL' },

      // PHONE patterns
      { label: 'Phone', testId: 'Field_Phone', expected: 'PHONE' },
      { label: 'Mobile', testId: 'Field_Mobile', expected: 'PHONE' },
      { label: 'Cell Phone', testId: 'Field_Cell', expected: 'PHONE' },
      { label: 'Telephone', testId: 'Field_Telephone', expected: 'PHONE' },
      { label: 'Contact Number', testId: 'Field_ContactNumber', expected: 'PHONE' },
      { label: 'Fax', testId: 'Field_Fax', expected: 'PHONE' },

      // ACCOUNT patterns
      { label: 'Account Number', testId: 'Field_AccountNumber', expected: 'ACCOUNT' },
      { label: 'Account Num', testId: 'Field_AcctNum', expected: 'ACCOUNT' },
      { label: 'Card Number', testId: 'Field_CardNum', expected: 'ACCOUNT' },
      { label: 'Credit Card', testId: 'Field_CreditCard', expected: 'ACCOUNT' },
      { label: 'Debit Card', testId: 'Field_DebitCard', expected: 'ACCOUNT' },
      { label: 'Policy Number', testId: 'Field_PolicyNum', expected: 'ACCOUNT' },
      { label: 'Claim Number', testId: 'Field_ClaimNum', expected: 'ACCOUNT' },
      { label: 'Loan Number', testId: 'Field_LoanNum', expected: 'ACCOUNT' },

      // ADDRESS patterns
      { label: 'Address', testId: 'Field_Address', expected: 'ADDRESS' },
      { label: 'Street', testId: 'Field_Street', expected: 'ADDRESS' },
      { label: 'City', testId: 'Field_City', expected: 'ADDRESS' },
      { label: 'State', testId: 'Field_State', expected: 'ADDRESS' },
      { label: 'ZIP', testId: 'Field_ZIP', expected: 'ADDRESS' },
      { label: 'Postal Code', testId: 'Field_PostalCode', expected: 'ADDRESS' },
      { label: 'Location', testId: 'Field_Location', expected: 'ADDRESS' },
      { label: 'Residence', testId: 'Field_Residence', expected: 'ADDRESS' },

      // INCOME patterns
      { label: 'Income', testId: 'Field_Income', expected: 'INCOME' },
      { label: 'Salary', testId: 'Field_Salary', expected: 'INCOME' },
      { label: 'Annual Income', testId: 'Field_AnnualIncome', expected: 'INCOME' },

      // Non-PII patterns
      { label: 'Status', testId: 'Field_Status', expected: null },
      { label: 'Description', testId: 'Field_Description', expected: null },
      { label: 'Priority', testId: 'Field_Priority', expected: null },
    ];

    testCases.forEach(({ label, testId, expected }) => {
      it(`should classify "${label}" (${testId}) as ${expected ?? 'null'}`, () => {
        const result = masker.classify(label, testId);
        expect(result).toBe(expected);
      });
    });
  });

  describe('mask', () => {
    it('should mask NAME values with tokens', () => {
      const value1 = masker.mask('John', 'NAME');
      const value2 = masker.mask('Jane', 'NAME');
      const value3 = masker.mask('John', 'NAME'); // Same value

      expect(value1).toBe('{NAME_1}');
      expect(value2).toBe('{NAME_2}');
      expect(value3).toBe('{NAME_1}'); // Should reuse existing token
    });

    it('should mask SSN values with tokens', () => {
      const value = masker.mask('123-45-6789', 'SSN');
      expect(value).toBe('{SSN_1}');
    });

    it('should not mask null category', () => {
      const value = masker.mask('Some Value', null);
      expect(value).toBe('Some Value');
    });

    it('should not mask empty values', () => {
      const value = masker.mask('', 'NAME');
      expect(value).toBe('');
    });
  });

  describe('resolve', () => {
    it('should resolve tokens back to original values', () => {
      masker.mask('John', 'NAME');
      masker.mask('123-45-6789', 'SSN');

      expect(masker.resolve('{NAME_1}')).toBe('John');
      expect(masker.resolve('{SSN_1}')).toBe('123-45-6789');
    });

    it('should return original value for non-tokens', () => {
      expect(masker.resolve('regular text')).toBe('regular text');
      expect(masker.resolve(null)).toBe(null);
      expect(masker.resolve(undefined)).toBe(null);
    });
  });

  describe('resolveString', () => {
    it('should resolve all tokens in a string', () => {
      masker.mask('John', 'NAME');
      masker.mask('Doe', 'NAME');
      masker.mask('john@example.com', 'EMAIL');

      const text = 'Name: {NAME_1} {NAME_2}, Email: {EMAIL_1}';
      const resolved = masker.resolveString(text);

      expect(resolved).toBe('Name: John Doe, Email: john@example.com');
    });
  });

  describe('clearSession', () => {
    it('should completely wipe token map', () => {
      masker.mask('John', 'NAME');
      masker.mask('123-45-6789', 'SSN');

      const statsBefore = masker.getStats();
      expect(statsBefore.totalTokens).toBe(2);

      masker.clearSession();

      const statsAfter = masker.getStats();
      expect(statsAfter.totalTokens).toBe(0);

      // Tokens should no longer resolve
      expect(masker.resolve('{NAME_1}')).toBe('{NAME_1}');
    });
  });

  describe('session isolation', () => {
    it('should not have cross-contamination between sessions', () => {
      // First session
      masker.mask('John', 'NAME');
      expect(masker.resolve('{NAME_1}')).toBe('John');

      // Clear and start new session
      masker.clearSession();

      // New session should start fresh
      masker.mask('Jane', 'NAME');
      expect(masker.resolve('{NAME_1}')).toBe('Jane');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      masker.mask('John', 'NAME');
      masker.mask('Jane', 'NAME');
      masker.mask('123-45-6789', 'SSN');
      masker.mask('john@example.com', 'EMAIL');

      const stats = masker.getStats();

      expect(stats.totalTokens).toBe(4);
      expect(stats.byCategory['NAME']).toBe(2);
      expect(stats.byCategory['SSN']).toBe(1);
      expect(stats.byCategory['EMAIL']).toBe(1);
    });
  });
});
