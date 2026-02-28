import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { renderPrompt, PromptType, getGuardrailText } from '../lib/ai/prompt-templates';
import { SYSTEM_GUARDRAIL } from '../lib/ai/guardrails';

// Feature: mimamori-reliability-audit, Property 18: Guardrail consistency across all prompts
// Feature: mimamori-reliability-audit, Property 19: Prompt context includes patient conditions

/**
 * Property 18: Guardrail consistency across all prompts
 *
 * *For any* prompt type (default-analysis, visit-prep, generate-probes) and any
 * file analysis prompt, the rendered prompt text should contain the shared
 * SYSTEM_GUARDRAIL constant and should NOT contain contradictory instructions
 * such as "Extract diagnoses" or "Identify the diagnosis".
 *
 * **Validates: Requirements 20.1, 20.2, 20.3**
 */

/**
 * Property 19: Prompt context includes patient conditions
 *
 * *For any* prompt rendered for generate-probes or visit-prep prompt types,
 * when patient conditions and allergies are provided, the rendered prompt text
 * should contain those conditions and allergies. The prompt should also contain
 * the relevance instruction "Generate questions relevant only to the patient's
 * documented conditions".
 *
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.4**
 */

/** Arbitrary for all prompt types. */
const promptTypeArb: fc.Arbitrary<PromptType> = fc.constantFrom(
  'default-analysis',
  'visit-prep',
  'generate-probes',
);

/** Arbitrary for prompt types that accept patient context. */
const contextPromptTypeArb: fc.Arbitrary<PromptType> = fc.constantFrom(
  'visit-prep',
  'generate-probes',
);

/** Arbitrary for non-empty log entries. */
const logsArb = fc.array(
  fc.record({
    date: fc.tuple(
      fc.integer({ min: 2020, max: 2025 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 }),
    ).map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`),
    text: fc.string({ minLength: 1, maxLength: 100 }),
  }),
  { minLength: 0, maxLength: 5 },
);

/** Arbitrary for document entries. */
const documentsArb = fc.array(
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    type: fc.constantFrom('Lab Result', 'Prescription', 'Imaging', 'Other'),
  }),
  { minLength: 0, maxLength: 3 },
);

/**
 * Arbitrary for a non-empty condition string.
 * Uses realistic medical condition names to avoid edge cases with empty strings.
 */
const conditionArb = fc.constantFrom(
  'Hypertension',
  'Type 2 Diabetes',
  'Asthma',
  'Chronic Pain',
  'Arthritis',
  'Heart Failure',
  'COPD',
  'Migraine',
  'Anxiety',
  'Depression',
);

/**
 * Arbitrary for a non-empty allergy string.
 */
const allergyArb = fc.constantFrom(
  'Penicillin',
  'Sulfa',
  'Aspirin',
  'Ibuprofen',
  'Latex',
  'Peanuts',
  'Shellfish',
  'Codeine',
  'Amoxicillin',
  'Morphine',
);

/** Contradictory instructions that must never appear in rendered prompts. */
const CONTRADICTORY_INSTRUCTIONS = [
  'Extract diagnoses',
  'Identify the diagnosis',
];

describe('Property 18: Guardrail consistency across all prompts', () => {
  it('every rendered prompt contains the shared SYSTEM_GUARDRAIL constant', () => {
    fc.assert(
      fc.property(promptTypeArb, logsArb, documentsArb, (type, logs, documents) => {
        const rendered = renderPrompt(type, { logs, documents });
        expect(rendered).toContain(SYSTEM_GUARDRAIL);
      }),
      { numRuns: 20 },
    );
  });

  it('getGuardrailText returns the same constant used in prompts', () => {
    const guardrailText = getGuardrailText();
    expect(guardrailText).toBe(SYSTEM_GUARDRAIL);
  });

  it('no rendered prompt contains contradictory diagnostic instructions', () => {
    fc.assert(
      fc.property(promptTypeArb, logsArb, documentsArb, (type, logs, documents) => {
        const rendered = renderPrompt(type, { logs, documents });
        const lower = rendered.toLowerCase();
        for (const phrase of CONTRADICTORY_INSTRUCTIONS) {
          expect(lower).not.toContain(phrase.toLowerCase());
        }
      }),
      { numRuns: 20 },
    );
  });

  it('guardrail is present even with varying conditions and allergies', () => {
    fc.assert(
      fc.property(
        promptTypeArb,
        logsArb,
        documentsArb,
        fc.array(conditionArb, { minLength: 0, maxLength: 3 }),
        fc.array(allergyArb, { minLength: 0, maxLength: 3 }),
        (type, logs, documents, conditions, allergies) => {
          const rendered = renderPrompt(type, { logs, documents, conditions, allergies });
          expect(rendered).toContain(SYSTEM_GUARDRAIL);
        },
      ),
      { numRuns: 20 },
    );
  });
});

describe('Property 19: Prompt context includes patient conditions', () => {
  it('rendered prompt contains provided conditions when non-empty', () => {
    fc.assert(
      fc.property(
        contextPromptTypeArb,
        logsArb,
        documentsArb,
        fc.array(conditionArb, { minLength: 1, maxLength: 4 }),
        (type, logs, documents, conditions) => {
          const rendered = renderPrompt(type, { logs, documents, conditions });
          for (const condition of conditions) {
            expect(rendered).toContain(condition);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('rendered prompt contains provided allergies when non-empty', () => {
    fc.assert(
      fc.property(
        contextPromptTypeArb,
        logsArb,
        documentsArb,
        fc.array(allergyArb, { minLength: 1, maxLength: 4 }),
        (type, logs, documents, allergies) => {
          const rendered = renderPrompt(type, { logs, documents, allergies });
          for (const allergy of allergies) {
            expect(rendered).toContain(allergy);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('rendered prompt contains the relevance instruction', () => {
    fc.assert(
      fc.property(
        contextPromptTypeArb,
        logsArb,
        documentsArb,
        fc.array(conditionArb, { minLength: 1, maxLength: 3 }),
        fc.array(allergyArb, { minLength: 0, maxLength: 3 }),
        (type, logs, documents, conditions, allergies) => {
          const rendered = renderPrompt(type, { logs, documents, conditions, allergies });
          expect(rendered).toContain(
            "Generate questions relevant only to the patient's documented conditions",
          );
        },
      ),
      { numRuns: 20 },
    );
  });

  it('rendered prompt contains both conditions and allergies together', () => {
    fc.assert(
      fc.property(
        contextPromptTypeArb,
        logsArb,
        documentsArb,
        fc.array(conditionArb, { minLength: 1, maxLength: 3 }),
        fc.array(allergyArb, { minLength: 1, maxLength: 3 }),
        (type, logs, documents, conditions, allergies) => {
          const rendered = renderPrompt(type, { logs, documents, conditions, allergies });
          // All conditions present
          for (const condition of conditions) {
            expect(rendered).toContain(condition);
          }
          // All allergies present
          for (const allergy of allergies) {
            expect(rendered).toContain(allergy);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
