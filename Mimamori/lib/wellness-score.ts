/**
 * Pure wellness score computation from daily log probe answers.
 *
 * Weighted formula: Sleep 25%, Pain 25%, Energy 25%, Medication 25%.
 * Each factor maps probe answer text to a 0–100 value.
 * Missing factors default to a baseline of 50.
 */

/** Shape of a single probe answer from a daily log. */
export interface ProbeAnswer {
  question: string;
  title: string;
  answer: string;
}

/** Result of computing the wellness score. */
export interface WellnessBreakdown {
  score: number;
  breakdown: {
    sleep: number;
    pain: number;
    energy: number;
    medication: number;
  };
}

const BASELINE = 50;

/**
 * Map a sleep quality answer to a 0–100 value.
 * "good"/"restful"/"7-9" → 90, "fair"/"5-6" → 60, "poor"/"<5" → 20, missing → 50
 */
export function scoreSleep(answer: string | undefined): number {
  if (!answer) return BASELINE;
  const a = answer.toLowerCase();
  if (a.includes('good') || a.includes('restful') || a.includes('7-9')) return 90;
  if (a.includes('fair') || a.includes('5-6')) return 60;
  if (a.includes('poor') || a.includes('<5')) return 20;
  return BASELINE;
}

/**
 * Map a pain level answer to a 0–100 value.
 * "none" → 100, "mild" → 75, "moderate" → 45, "severe" → 15, missing → 50
 */
export function scorePain(answer: string | undefined): number {
  if (!answer) return BASELINE;
  const a = answer.toLowerCase();
  if (a.includes('none')) return 100;
  if (a.includes('mild')) return 75;
  if (a.includes('moderate')) return 45;
  if (a.includes('severe')) return 15;
  return BASELINE;
}

/**
 * Map an energy level answer to a 0–100 value.
 * "good"/"high" → 90, "moderate" → 60, "low"/"fatigue" → 25, missing → 50
 */
export function scoreEnergy(answer: string | undefined): number {
  if (!answer) return BASELINE;
  const a = answer.toLowerCase();
  if (a.includes('good') || a.includes('high')) return 90;
  if (a.includes('moderate')) return 60;
  if (a.includes('low') || a.includes('fatigue')) return 25;
  return BASELINE;
}

/**
 * Map a medication adherence answer to a 0–100 value.
 * "all"/"yes" → 100, "missed one" → 50, "missed" → 15, missing → 50
 *
 * Note: "missed one" is checked before "missed" to avoid false matches.
 */
export function scoreMedication(answer: string | undefined): number {
  if (!answer) return BASELINE;
  const a = answer.toLowerCase();
  if (a.includes('all') || a.includes('yes')) return 100;
  if (a.includes('missed one')) return 50;
  if (a.includes('missed')) return 15;
  return BASELINE;
}

/**
 * Compute a wellness score from an array of probe answers.
 *
 * Looks for probes titled "Sleep Quality", "Pain Level", "Energy Level",
 * and "Medication" (matching the titles used in the daily log).
 * Each factor is weighted equally at 25%.
 * Missing factors use a baseline value of 50.
 *
 * @param probeAnswers - Array of probe answers from one or more daily logs
 * @returns WellnessBreakdown with overall score and per-factor breakdown
 */
export function computeWellnessScore(probeAnswers: ProbeAnswer[]): WellnessBreakdown {
  const sleepAnswer = probeAnswers.find(p => p.title === 'Sleep Quality')?.answer;
  const painAnswer = probeAnswers.find(p => p.title === 'Pain Level')?.answer;
  const energyAnswer = probeAnswers.find(p => p.title === 'Energy Level')?.answer;
  const medAnswer = probeAnswers.find(p => p.title === 'Medication')?.answer;

  const sleep = scoreSleep(sleepAnswer);
  const pain = scorePain(painAnswer);
  const energy = scoreEnergy(energyAnswer);
  const medication = scoreMedication(medAnswer);

  const score = Math.round(sleep * 0.25 + pain * 0.25 + energy * 0.25 + medication * 0.25);

  return {
    score: Math.min(100, Math.max(0, score)),
    breakdown: { sleep, pain, energy, medication },
  };
}
