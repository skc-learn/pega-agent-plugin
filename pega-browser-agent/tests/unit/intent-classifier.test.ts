/**
 * Intent Classifier Tests
 *
 * Test all 11 intents with positive and negative examples.
 */

import {
  classifyIntent,
  requiresLLM,
  isLocalIntent,
  getSupportedIntents,
} from '../../src/shared/intent-classifier';
import type { IntentType } from '../../src/shared/types';

describe('IntentClassifier', () => {
  describe('classifyIntent', () => {
    const testCases: Array<{
      intent: IntentType;
      positive: string[];
      negative: string[];
      expectedRequiresLLM: boolean;
    }> = [
      {
        intent: 'SUMMARIZE_CASE',
        positive: [
          'Summarize this case',
          "What's this case about?",
          'Give me a summary',
          'Brief me on this case',
          'Catch me up on this case',
        ],
        negative: [
          'Update the status',
          'Create a new case',
          'Save the changes',
        ],
        expectedRequiresLLM: false,
      },
      {
        intent: 'SUBMIT_CASE',
        positive: [
          'Submit this case',
          'Complete this case',
          'Finish the case',
          'Close case',
        ],
        negative: [
          'Summarize the case',
          'Save changes',
          'Create a new case',
        ],
        expectedRequiresLLM: false,
      },
      {
        intent: 'SAVE_CASE',
        positive: [
          'Save',
          'Save changes',
          'Save and continue',
        ],
        negative: [
          'Submit the case',
          'Save this case to database', // Should match SUBMIT
          'Cancel save',
        ],
        expectedRequiresLLM: false,
      },
      {
        intent: 'NEXT_STEP',
        positive: [
          'Next',
          'Next step',
          'Continue',
          'Proceed',
        ],
        negative: [
          'Previous step',
          'Go back',
          'Next case',
        ],
        expectedRequiresLLM: false,
      },
      {
        intent: 'SHOW_QUEUE',
        positive: [
          'My queue',
          'My cases',
          "What's in my queue",
          'Show my work',
        ],
        negative: [
          'Open case',
          'My queue is empty', // Should still match
          'Show queue details',
        ],
        expectedRequiresLLM: false,
      },
      {
        intent: 'ESCALATE',
        positive: [
          'Escalate this case',
          'Transfer to supervisor',
          'Route to manager',
          'Assign to team lead',
        ],
        negative: [
          'Show escalation',
          'Create escalation',
          'Cancel escalation',
        ],
        expectedRequiresLLM: true,
      },
      {
        intent: 'CREATE_CASE',
        positive: [
          'Create a new case',
          'New case',
          'Open a new loan application',
          'Start a new claim',
        ],
        negative: [
          'Show my cases',
          'Open case ABC-123', // Should match OPEN_CASE
          'Delete case',
        ],
        expectedRequiresLLM: true,
      },
      {
        intent: 'OPEN_CASE',
        positive: [
          'Open case ABC-123',
          'Go to case XYZ-456',
          'Find case ABC-123',
        ],
        negative: [
          'Create a new case',
          'Open a new case',
          'Show case details',
        ],
        expectedRequiresLLM: true,
      },
      {
        intent: 'SEARCH',
        positive: [
          'Find cases with status open',
          'Search for customer John',
          'Look up case ABC-123',
          'Show me cases assigned to me',
        ],
        negative: [
          'Open case ABC-123', // Should match OPEN_CASE
          'Search is not working',
        ],
        expectedRequiresLLM: true,
      },
      {
        intent: 'UPDATE_FIELD',
        positive: [
          'Update the status',
          'Set priority to high',
          'Change the value',
          'Fill in the form',
          'Enter John in the name field',
          'Put high in priority',
        ],
        negative: [
          'Update this case', // Ambiguous
          'Show update',
        ],
        expectedRequiresLLM: true,
      },
      {
        intent: 'EXPLAIN',
        positive: [
          'Why is this case pending?',
          'Explain the approval process',
          'Tell me about this case',
          'What is the reason for rejection?',
        ],
        negative: [
          'Show explanation',
          'Create explanation',
        ],
        expectedRequiresLLM: true,
      },
    ];

    testCases.forEach(({ intent, positive, negative, expectedRequiresLLM }) => {
      describe(`${intent}`, () => {
        positive.forEach((command) => {
          it(`should classify "${command}" as ${intent}`, () => {
            const result = classifyIntent(command);
            expect(result.intent).toBe(intent);
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.requiresLLM).toBe(expectedRequiresLLM);
          });
        });

        negative.forEach((command) => {
          it(`should NOT classify "${command}" as ${intent}`, () => {
            const result = classifyIntent(command);
            // Either it's a different intent or UNKNOWN
            expect(result.intent === intent).toBe(false);
          });
        });
      });
    });

    it('should return UNKNOWN for empty commands', () => {
      const result = classifyIntent('');
      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
      expect(result.requiresLLM).toBe(true);
    });

    it('should return UNKNOWN for unrecognized commands', () => {
      const result = classifyIntent('xyzabc123');
      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
      expect(result.requiresLLM).toBe(true);
    });
  });

  describe('requiresLLM', () => {
    it('should return true for intents that need LLM', () => {
      const llmIntents: IntentType[] = [
        'UPDATE_FIELD',
        'CREATE_CASE',
        'SEARCH',
        'OPEN_CASE',
        'ESCALATE',
        'EXPLAIN',
        'UNKNOWN',
        'AMBIGUOUS',
      ];

      llmIntents.forEach((intent) => {
        expect(requiresLLM(intent)).toBe(true);
      });
    });

    it('should return false for local intents', () => {
      const localIntents: IntentType[] = [
        'SUMMARIZE_CASE',
        'SUBMIT_CASE',
        'SAVE_CASE',
        'NEXT_STEP',
        'SHOW_QUEUE',
      ];

      localIntents.forEach((intent) => {
        expect(requiresLLM(intent)).toBe(false);
      });
    });
  });

  describe('isLocalIntent', () => {
    it('should return opposite of requiresLLM', () => {
      const intents: IntentType[] = [
        'SUMMARIZE_CASE',
        'UPDATE_FIELD',
        'UNKNOWN',
      ];

      intents.forEach((intent) => {
        expect(isLocalIntent(intent)).toBe(!requiresLLM(intent));
      });
    });
  });

  describe('getSupportedIntents', () => {
    it('should return all supported intents', () => {
      const intents = getSupportedIntents();

      expect(intents).toContain('SUMMARIZE_CASE');
      expect(intents).toContain('SUBMIT_CASE');
      expect(intents).toContain('SAVE_CASE');
      expect(intents).toContain('NEXT_STEP');
      expect(intents).toContain('SHOW_QUEUE');
      expect(intents).toContain('ESCALATE');
      expect(intents).toContain('CREATE_CASE');
      expect(intents).toContain('OPEN_CASE');
      expect(intents).toContain('SEARCH');
      expect(intents).toContain('UPDATE_FIELD');
      expect(intents).toContain('EXPLAIN');
    });
  });
});
