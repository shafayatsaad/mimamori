import { describe, it, expect } from 'vitest';
import {
  computeWellnessScore,
  scoreSleep,
  scorePain,
  scoreEnergy,
  scoreMedication,
  type ProbeAnswer,
} from '@/lib/wellness-score';

describe('scoreSleep', () => {
  it('returns 90 for "good"', () => expect(scoreSleep('good')).toBe(90));
  it('returns 90 for "restful"', () => expect(scoreSleep('restful')).toBe(90));
  it('returns 90 for "7-9"', () => expect(scoreSleep('7-9 hours')).toBe(90));
  it('returns 60 for "fair"', () => expect(scoreSleep('fair')).toBe(60));
  it('returns 60 for "5-6"', () => expect(scoreSleep('5-6 hours')).toBe(60));
  it('returns 20 for "poor"', () => expect(scoreSleep('poor')).toBe(20));
  it('returns 20 for "<5"', () => expect(scoreSleep('<5 hours')).toBe(20));
  it('returns 50 for undefined', () => expect(scoreSleep(undefined)).toBe(50));
  it('returns 50 for unrecognized answer', () => expect(scoreSleep('unknown')).toBe(50));
});

describe('scorePain', () => {
  it('returns 100 for "none"', () => expect(scorePain('none')).toBe(100));
  it('returns 75 for "mild"', () => expect(scorePain('mild')).toBe(75));
  it('returns 45 for "moderate"', () => expect(scorePain('moderate')).toBe(45));
  it('returns 15 for "severe"', () => expect(scorePain('severe')).toBe(15));
  it('returns 50 for undefined', () => expect(scorePain(undefined)).toBe(50));
  it('returns 50 for unrecognized answer', () => expect(scorePain('unknown')).toBe(50));
});

describe('scoreEnergy', () => {
  it('returns 90 for "good"', () => expect(scoreEnergy('good')).toBe(90));
  it('returns 90 for "high"', () => expect(scoreEnergy('high')).toBe(90));
  it('returns 60 for "moderate"', () => expect(scoreEnergy('moderate')).toBe(60));
  it('returns 25 for "low"', () => expect(scoreEnergy('low')).toBe(25));
  it('returns 25 for "fatigue"', () => expect(scoreEnergy('fatigue')).toBe(25));
  it('returns 50 for undefined', () => expect(scoreEnergy(undefined)).toBe(50));
  it('returns 50 for unrecognized answer', () => expect(scoreEnergy('unknown')).toBe(50));
});

describe('scoreMedication', () => {
  it('returns 100 for "all"', () => expect(scoreMedication('all')).toBe(100));
  it('returns 100 for "yes"', () => expect(scoreMedication('yes')).toBe(100));
  it('returns 50 for "missed one"', () => expect(scoreMedication('missed one')).toBe(50));
  it('returns 15 for "missed"', () => expect(scoreMedication('missed')).toBe(15));
  it('returns 50 for undefined', () => expect(scoreMedication(undefined)).toBe(50));
  it('returns 50 for unrecognized answer', () => expect(scoreMedication('unknown')).toBe(50));
});

describe('computeWellnessScore', () => {
  it('returns baseline 50 for all factors when no probe answers', () => {
    const result = computeWellnessScore([]);
    expect(result.score).toBe(50);
    expect(result.breakdown).toEqual({ sleep: 50, pain: 50, energy: 50, medication: 50 });
  });

  it('computes correct score with all factors present', () => {
    const probes: ProbeAnswer[] = [
      { question: '', title: 'Sleep Quality', answer: 'good' },
      { question: '', title: 'Pain Level', answer: 'none' },
      { question: '', title: 'Energy Level', answer: 'high' },
      { question: '', title: 'Medication', answer: 'all' },
    ];
    const result = computeWellnessScore(probes);
    // (90 + 100 + 90 + 100) * 0.25 = 95
    expect(result.score).toBe(95);
    expect(result.breakdown).toEqual({ sleep: 90, pain: 100, energy: 90, medication: 100 });
  });

  it('uses baseline 50 for missing factors', () => {
    const probes: ProbeAnswer[] = [
      { question: '', title: 'Sleep Quality', answer: 'good' },
    ];
    const result = computeWellnessScore(probes);
    // (90 + 50 + 50 + 50) * 0.25 = 60
    expect(result.score).toBe(60);
    expect(result.breakdown.sleep).toBe(90);
    expect(result.breakdown.pain).toBe(50);
    expect(result.breakdown.energy).toBe(50);
    expect(result.breakdown.medication).toBe(50);
  });

  it('computes worst-case score correctly', () => {
    const probes: ProbeAnswer[] = [
      { question: '', title: 'Sleep Quality', answer: 'poor' },
      { question: '', title: 'Pain Level', answer: 'severe' },
      { question: '', title: 'Energy Level', answer: 'low' },
      { question: '', title: 'Medication', answer: 'missed' },
    ];
    const result = computeWellnessScore(probes);
    // (20 + 15 + 25 + 15) * 0.25 = 18.75 → 19
    expect(result.score).toBe(19);
    expect(result.breakdown).toEqual({ sleep: 20, pain: 15, energy: 25, medication: 15 });
  });

  it('clamps score to 0-100 range', () => {
    // All best answers still produce a score within range
    const probes: ProbeAnswer[] = [
      { question: '', title: 'Sleep Quality', answer: 'good' },
      { question: '', title: 'Pain Level', answer: 'none' },
      { question: '', title: 'Energy Level', answer: 'high' },
      { question: '', title: 'Medication', answer: 'all' },
    ];
    const result = computeWellnessScore(probes);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('is case-insensitive for answers', () => {
    const probes: ProbeAnswer[] = [
      { question: '', title: 'Sleep Quality', answer: 'GOOD' },
      { question: '', title: 'Pain Level', answer: 'None' },
      { question: '', title: 'Energy Level', answer: 'HIGH' },
      { question: '', title: 'Medication', answer: 'YES' },
    ];
    const result = computeWellnessScore(probes);
    expect(result.score).toBe(95);
  });
});
