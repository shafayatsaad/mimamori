/**
 * Critical alert detection utilities for health metrics.
 *
 * - detectCriticalBP: classify blood pressure readings
 * - detectCriticalKeywords: detect severity keywords in text
 * - checkInactivity: compute hours since most recent log entry
 */

/** Blood pressure classification result. */
export type BPClassification = 'crisis' | 'low' | 'normal';

/** Minimum shape for a log entry used by checkInactivity. */
export interface LogEntry {
  createdAt?: string;
  date?: string;
}

/** Severity keywords checked case-insensitively. */
const SEVERITY_KEYWORDS = [
  'critical',
  'urgent',
  'emergency',
  'life-threatening',
  'immediate attention',
] as const;

/**
 * Parse a blood pressure string and classify it.
 *
 * Format: "systolic/diastolic" (e.g. "120/80").
 * - Systolic >180 or Diastolic >120 → 'crisis'
 * - Systolic <90 or Diastolic <60 → 'low'
 * - Otherwise → 'normal'
 * - Invalid or null input → null
 */
export function detectCriticalBP(bpString: string | null | undefined): BPClassification | null {
  if (!bpString || typeof bpString !== 'string') return null;

  const parts = bpString.trim().split('/');
  if (parts.length !== 2) return null;

  const systolic = Number(parts[0]);
  const diastolic = Number(parts[1]);

  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null;

  if (systolic > 180 || diastolic > 120) return 'crisis';
  if (systolic < 90 || diastolic < 60) return 'low';
  return 'normal';
}

/**
 * Check whether text contains any severity keywords (case-insensitive).
 *
 * Keywords: "critical", "urgent", "emergency", "life-threatening", "immediate attention"
 */
export function detectCriticalKeywords(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return false;

  const lower = text.toLowerCase();
  return SEVERITY_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Return the number of hours since the most recent log entry.
 *
 * Each log entry should have a `createdAt` or `date` field (ISO 8601 string).
 * Returns `Infinity` for an empty list.
 * The result is always >= 0.
 */
export function checkInactivity(logs: LogEntry[]): number {
  if (!logs || logs.length === 0) return Infinity;

  let mostRecent = -Infinity;

  for (const log of logs) {
    const timestamp = log.createdAt || log.date;
    if (!timestamp) continue;

    const time = new Date(timestamp).getTime();
    if (!Number.isFinite(time)) continue;

    if (time > mostRecent) {
      mostRecent = time;
    }
  }

  // If no valid timestamps were found, treat as empty
  if (mostRecent === -Infinity) return Infinity;

  const now = Date.now();
  const diffMs = now - mostRecent;
  const hours = diffMs / (1000 * 60 * 60);

  return Math.max(0, hours);
}
