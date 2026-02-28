import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  renderPrompt,
  getGuardrailText,
  type PromptType,
} from '@/lib/ai/prompt-templates';

/**
 * Feature: static-to-dynamic-conversion
 * Property 9: Prompt rendering includes interpolated data and guardrail
 *
 * For any prompt type and any non-empty logs/documents data,
 * renderPrompt should produce a string that contains a representation
 * of the provided logs data, a representation of the provided documents
 * data, and the medical guardrail text ("Mimamori does NOT diagnose").
 *
 * **Validates: Requirements 8.2, 8.3**
 */

const ALL_PROMPT_TYPES: PromptType[] = [
  'default-analysis',
  'visit-prep',
  'generate-probes',
];

/** Arbitrary for a simple log object with string key-value pairs. */
const logEntryArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.string({ minLength: 1, maxLength: 50 }),
  { minKeys: 1, maxKeys: 5 },
);

/** Arbitrary for a simple document object with string key-value pairs. */
const documentEntryArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.string({ minLength: 1, maxLength: 50 }),
  { minKeys: 1, maxKeys: 5 },
);

describe('Property 9: Prompt rendering includes interpolated data and guardrail', () => {
  it('rendered prompt contains JSON representation of logs data', () => {
    const promptTypeArb = fc.constantFrom(...ALL_PROMPT_TYPES);
    const logsArb = fc.array(logEntryArb, { minLength: 1, maxLength: 5 });
    const docsArb = fc.array(documentEntryArb, { minLength: 0, maxLength: 3 });

    fc.assert(
      fc.property(promptTypeArb, logsArb, docsArb, (type, logs, docs) => {
        const rendered = renderPrompt(type, { logs, documents: docs });
        const logsJson = JSON.stringify(logs);

        expect(rendered).toContain(logsJson);
      }),
      { numRuns: 20 },
    );
  });

  it('rendered prompt contains JSON representation of documents data', () => {
    const promptTypeArb = fc.constantFrom(...ALL_PROMPT_TYPES);
    const logsArb = fc.array(logEntryArb, { minLength: 0, maxLength: 3 });
    const docsArb = fc.array(documentEntryArb, { minLength: 1, maxLength: 5 });

    fc.assert(
      fc.property(promptTypeArb, logsArb, docsArb, (type, logs, docs) => {
        const rendered = renderPrompt(type, { logs, documents: docs });
        const docsJson = JSON.stringify(docs);

        expect(rendered).toContain(docsJson);
      }),
      { numRuns: 20 },
    );
  });

  it('rendered prompt always contains the guardrail text', () => {
    const promptTypeArb = fc.constantFrom(...ALL_PROMPT_TYPES);
    const logsArb = fc.array(logEntryArb, { minLength: 0, maxLength: 5 });
    const docsArb = fc.array(documentEntryArb, { minLength: 0, maxLength: 5 });
    const guardrail = getGuardrailText();

    fc.assert(
      fc.property(promptTypeArb, logsArb, docsArb, (type, logs, docs) => {
        const rendered = renderPrompt(type, { logs, documents: docs });

        expect(rendered).toContain('Mimamori does NOT diagnose');
        expect(rendered).toContain(guardrail);
      }),
      { numRuns: 20 },
    );
  });

  it('rendered prompt contains all three: logs, documents, and guardrail simultaneously', () => {
    const promptTypeArb = fc.constantFrom(...ALL_PROMPT_TYPES);
    const logsArb = fc.array(logEntryArb, { minLength: 1, maxLength: 4 });
    const docsArb = fc.array(documentEntryArb, { minLength: 1, maxLength: 4 });
    const guardrail = getGuardrailText();

    fc.assert(
      fc.property(promptTypeArb, logsArb, docsArb, (type, logs, docs) => {
        const rendered = renderPrompt(type, { logs, documents: docs });

        expect(rendered).toContain(JSON.stringify(logs));
        expect(rendered).toContain(JSON.stringify(docs));
        expect(rendered).toContain(guardrail);
      }),
      { numRuns: 20 },
    );
  });
});
