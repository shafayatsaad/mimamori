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

// Feature: mimamori-production-readiness, Property 4: Wellness score computation

/**
 * Property 4: Wellness score computation
 *
 * *For any* set of probe answers (including cases where some or all factors are
 * missing), the `computeWellnessScore` function should return a score equal to
 * `(sleep * 0.25) + (pain * 0.25) + (energy * 0.25) + (medication * 0.25)`
 * where each missing factor uses the baseline value of 50, and the final score
 * is clamped to [0, 100].
 *
 * **Validates: Requirements 5.1, 5.5**
 */

// --- Arbitraries ---

/** Known sleep answer keywords mapped to their expected scores. */
const SLEEP_ANSWERS: Array<{ answer: string; score: number }> = [
  { answer: 'good', score: 90 },
  { answer: 'restful', score: 90 },
  { answer: '7-9 hours', score: 90 },
  { answer: 'fair', score: 60 },
  { answer: '5-6 hours', score: 60 },
  { answer: 'poor', score: 20 },
  { answer: '<5 hours', score: 20 },
];

const PAIN_ANSWERS: Array<{ answer: string; score: number }> = [
  { answer: 'none', score: 100 },
  { answer: 'mild', score: 75 },
  { answer: 'moderate', score: 45 },
  { answer: 'severe', score: 15 },
];

const ENERGY_ANSWERS: Array<{ answer: string; score: number }> = [
  { answer: 'good', score: 90 },
  { answer: 'high', score: 90 },
  { answer: 'moderate', score: 60 },
  { answer: 'low', score: 25 },
  { answer: 'fatigue', score: 25 },
];

const MEDICATION_ANSWERS: Array<{ answer: string; score: number }> = [
  { answer: 'all', score: 100 },
  { answer: 'yes', score: 100 },
  { answer: 'missed one', score: 50 },
  { answer: 'missed', score: 15 },
];

const BASELINE = 50;

/**
 * Generates an optional factor: either a known answer with its expected score,
 * or undefined (missing) which maps to the baseline of 50.
 */
function optionalFactorArb(
  knownAnswers: Array<{ answer: string; score: number }>,
): fc.Arbitrary<{ answer: string | undefined; expectedScore: number }> {
  return fc.oneof(
    // Missing factor → baseline
    fc.constant({ answer: undefined as string | undefined, expectedScore: BASELINE }),
    // Known answer
    fc.constantFrom(...knownAnswers).map((entry) => ({
      answer: entry.answer,
      expectedScore: entry.score,
    })),
    // Unrecognized answer → baseline
    fc.array(fc.constantFrom('x', 'z', '1', '2', ' '), { minLength: 1, maxLength: 8 })
      .map((chars) => chars.join(''))
      .filter((s) => {
        const lower = s.toLowerCase();
        return !knownAnswers.some((k) => lower.includes(k.answer.toLowerCase()));
      })
      .map((s) => ({ answer: s, expectedScore: BASELINE })),
  );
}

/** Generates a full set of four optional factors with their expected scores. */
const probeFactorsArb = fc.tuple(
  optionalFactorArb(SLEEP_ANSWERS),
  optionalFactorArb(PAIN_ANSWERS),
  optionalFactorArb(ENERGY_ANSWERS),
  optionalFactorArb(MEDICATION_ANSWERS),
);

/** Builds a ProbeAnswer array from optional factor values. */
function buildProbeAnswers(
  sleep: { answer: string | undefined },
  pain: { answer: string | undefined },
  energy: { answer: string | undefined },
  medication: { answer: string | undefined },
): ProbeAnswer[] {
  const probes: ProbeAnswer[] = [];
  if (sleep.answer !== undefined) {
    probes.push({ question: '', title: 'Sleep Quality', answer: sleep.answer });
  }
  if (pain.answer !== undefined) {
    probes.push({ question: '', title: 'Pain Level', answer: pain.answer });
  }
  if (energy.answer !== undefined) {
    probes.push({ question: '', title: 'Energy Level', answer: energy.answer });
  }
  if (medication.answer !== undefined) {
    probes.push({ question: '', title: 'Medication', answer: medication.answer });
  }
  return probes;
}

describe('Property 4: Wellness score computation', () => {
  it('score equals weighted sum of factor scores with baseline 50 for missing factors', () => {
    fc.assert(
      fc.property(probeFactorsArb, ([sleep, pain, energy, medication]) => {
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

  it('score is always clamped to [0, 100]', () => {
    fc.assert(
      fc.property(probeFactorsArb, ([sleep, pain, energy, medication]) => {
        const probes = buildProbeAnswers(sleep, pain, energy, medication);
        const result = computeWellnessScore(probes);

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }),
      { numRuns: 20 },
    );
  });

  it('all-missing factors produce baseline score of 50', () => {
    fc.assert(
      fc.property(
        // Generate random extra probes with non-matching titles to ensure they are ignored
        fc.array(
          fc.record({
            question: fc.string(),
            title: fc.array(fc.constantFrom('a', 'b', 'c'), { minLength: 1, maxLength: 5 })
              .map((chars) => chars.join(''))
              .filter((t) => !['Sleep Quality', 'Pain Level', 'Energy Level', 'Medication'].includes(t)),
            answer: fc.string(),
          }),
          { minLength: 0, maxLength: 5 },
        ),
        (extraProbes) => {
          const result = computeWellnessScore(extraProbes);
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

  it('individual scorer functions agree with breakdown values', () => {
    fc.assert(
      fc.property(probeFactorsArb, ([sleep, pain, energy, medication]) => {
        const probes = buildProbeAnswers(sleep, pain, energy, medication);
        const result = computeWellnessScore(probes);

        expect(result.breakdown.sleep).toBe(scoreSleep(sleep.answer));
        expect(result.breakdown.pain).toBe(scorePain(pain.answer));
        expect(result.breakdown.energy).toBe(scoreEnergy(energy.answer));
        expect(result.breakdown.medication).toBe(scoreMedication(medication.answer));
      }),
      { numRuns: 20 },
    );
  });
});
