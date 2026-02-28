import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  computeWellnessScore,
  scoreSleep,
  scorePain,
  scoreEnergy,
  scoreMedication,
  type ProbeAnswer,
} from '@/lib/wellness-score';

/**
 * Feature: mimamori-reliability-audit, Property 6: Wellness score weighted computation
 *
 * For any array of probe answers, computeWellnessScore should return a score
 * equal to round(sleep * 0.25 + pain * 0.25 + energy * 0.25 + medication * 0.25)
 * clamped to [0, 100], where each factor is derived from the corresponding
 * probe answer. When a factor's probe answer is missing, the baseline value
 * of 50 should be used.
 *
 * **Validates: Requirements 6.1, 6.5**
 */

// --- Known answer mappings ---

const SLEEP_KNOWN: Array<{ answer: string; score: number }> = [
  { answer: 'good', score: 90 },
  { answer: 'restful', score: 90 },
  { answer: '7-9 hours', score: 90 },
  { answer: 'fair', score: 60 },
  { answer: '5-6 hours', score: 60 },
  { answer: 'poor', score: 20 },
  { answer: '<5 hours', score: 20 },
];

const PAIN_KNOWN: Array<{ answer: string; score: number }> = [
  { answer: 'none', score: 100 },
  { answer: 'mild', score: 75 },
  { answer: 'moderate', score: 45 },
  { answer: 'severe', score: 15 },
];

const ENERGY_KNOWN: Array<{ answer: string; score: number }> = [
  { answer: 'good', score: 90 },
  { answer: 'high', score: 90 },
  { answer: 'moderate', score: 60 },
  { answer: 'low', score: 25 },
  { answer: 'fatigue', score: 25 },
];

const MEDICATION_KNOWN: Array<{ answer: string; score: number }> = [
  { answer: 'all', score: 100 },
  { answer: 'yes', score: 100 },
  { answer: 'missed one', score: 50 },
  { answer: 'missed', score: 15 },
];

const BASELINE = 50;

// --- Arbitraries ---

/**
 * Generates an optional factor: either a known answer string with its expected
 * score, an unrecognized string (baseline), or absent (baseline).
 */
function optionalFactorArb(
  knownAnswers: Array<{ answer: string; score: number }>,
): fc.Arbitrary<{ answer: string | undefined; expectedScore: number }> {
  return fc.oneof(
    // Missing factor → baseline
    fc.constant({ answer: undefined as string | undefined, expectedScore: BASELINE }),
    // Known answer → mapped score
    fc.constantFrom(...knownAnswers).map((e) => ({
      answer: e.answer,
      expectedScore: e.score,
    })),
    // Unrecognized answer → baseline
    fc.array(fc.constantFrom('x', 'z', '0', '9', '#'), { minLength: 1, maxLength: 6 })
      .map((chars) => chars.join(''))
      .filter((s) => {
        const lower = s.toLowerCase();
        return !knownAnswers.some((k) => lower.includes(k.answer.toLowerCase()));
      })
      .map((s) => ({ answer: s, expectedScore: BASELINE })),
  );
}

const allFactorsArb = fc.tuple(
  optionalFactorArb(SLEEP_KNOWN),
  optionalFactorArb(PAIN_KNOWN),
  optionalFactorArb(ENERGY_KNOWN),
  optionalFactorArb(MEDICATION_KNOWN),
);

/** Build a ProbeAnswer[] from optional factor values, omitting missing ones. */
function buildProbeAnswers(
  sleep: { answer: string | undefined },
  pain: { answer: string | undefined },
  energy: { answer: string | undefined },
  medication: { answer: string | undefined },
): ProbeAnswer[] {
  const probes: ProbeAnswer[] = [];
  if (sleep.answer !== undefined) {
    probes.push({ question: 'How did you sleep?', title: 'Sleep Quality', answer: sleep.answer });
  }
  if (pain.answer !== undefined) {
    probes.push({ question: 'Pain level?', title: 'Pain Level', answer: pain.answer });
  }
  if (energy.answer !== undefined) {
    probes.push({ question: 'Energy level?', title: 'Energy Level', answer: energy.answer });
  }
  if (medication.answer !== undefined) {
    probes.push({ question: 'Medication taken?', title: 'Medication', answer: medication.answer });
  }
  return probes;
}

describe('Feature: mimamori-reliability-audit, Property 6: Wellness score weighted computation', () => {
  it('score equals round(sleep*0.25 + pain*0.25 + energy*0.25 + medication*0.25) for any combination of known answers', () => {
    fc.assert(
      fc.property(allFactorsArb, ([sleep, pain, energy, medication]) => {
        const probes = buildProbeAnswers(sleep, pain, energy, medication);
        const result = computeWellnessScore(probes);

        const expectedRaw =
          sleep.expectedScore * 0.25 +
          pain.expectedScore * 0.25 +
          energy.expectedScore * 0.25 +
          medication.expectedScore * 0.25;
        const expectedScore = Math.min(100, Math.max(0, Math.round(expectedRaw)));

        expect(result.score).toBe(expectedScore);
        expect(result.breakdown.sleep).toBe(sleep.expectedScore);
        expect(result.breakdown.pain).toBe(pain.expectedScore);
        expect(result.breakdown.energy).toBe(energy.expectedScore);
        expect(result.breakdown.medication).toBe(medication.expectedScore);
      }),
      { numRuns: 20 },
    );
  });

  it('score is always in [0, 100]', () => {
    fc.assert(
      fc.property(allFactorsArb, ([sleep, pain, energy, medication]) => {
        const probes = buildProbeAnswers(sleep, pain, energy, medication);
        const result = computeWellnessScore(probes);

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }),
      { numRuns: 20 },
    );
  });

  it('missing factors use baseline of 50', () => {
    fc.assert(
      fc.property(
        fc.subarray(['Sleep Quality', 'Pain Level', 'Energy Level', 'Medication'] as const, {
          minLength: 0,
          maxLength: 4,
        }),
        (missingTitles) => {
          // Build probes with known answers for present factors, omit missing ones
          const probes: ProbeAnswer[] = [];
          if (!missingTitles.includes('Sleep Quality')) {
            probes.push({ question: '', title: 'Sleep Quality', answer: 'good' });
          }
          if (!missingTitles.includes('Pain Level')) {
            probes.push({ question: '', title: 'Pain Level', answer: 'none' });
          }
          if (!missingTitles.includes('Energy Level')) {
            probes.push({ question: '', title: 'Energy Level', answer: 'high' });
          }
          if (!missingTitles.includes('Medication')) {
            probes.push({ question: '', title: 'Medication', answer: 'all' });
          }

          const result = computeWellnessScore(probes);

          // Each missing factor should contribute baseline 50 to the breakdown
          for (const title of missingTitles) {
            if (title === 'Sleep Quality') expect(result.breakdown.sleep).toBe(BASELINE);
            if (title === 'Pain Level') expect(result.breakdown.pain).toBe(BASELINE);
            if (title === 'Energy Level') expect(result.breakdown.energy).toBe(BASELINE);
            if (title === 'Medication') expect(result.breakdown.medication).toBe(BASELINE);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('empty probe answers array returns score based on all baselines (50)', () => {
    fc.assert(
      fc.property(
        // Generate random extra probes with non-matching titles
        fc.array(
          fc.record({
            question: fc.string({ minLength: 0, maxLength: 10 }),
            title: fc.string({ minLength: 1, maxLength: 10 }).filter(
              (t) => !['Sleep Quality', 'Pain Level', 'Energy Level', 'Medication'].includes(t),
            ),
            answer: fc.string({ minLength: 0, maxLength: 10 }),
          }),
          { minLength: 0, maxLength: 5 },
        ),
        (irrelevantProbes) => {
          const result = computeWellnessScore(irrelevantProbes);

          expect(result.score).toBe(BASELINE);
          expect(result.breakdown).toEqual({
            sleep: BASELINE,
            pain: BASELINE,
            energy: BASELINE,
            medication: BASELINE,
          });
        },
      ),
      { numRuns: 20 },
    );
  });
});
