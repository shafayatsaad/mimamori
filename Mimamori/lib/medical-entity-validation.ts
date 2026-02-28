/**
 * Pure validation functions for medical entity processing.
 *
 * Extracted from the /api/analyze-file route so they can be tested
 * independently without mocking API routes.
 */

/** Recognized dosage units for medical entity validation */
const VALID_DOSAGE_UNITS = /\b(mg|ml|mcg|units|iu)\b/i;
const HAS_NUMERIC = /\d/;

/**
 * Validate a dosage string: must have at least one numeric component
 * AND at least one recognized unit pattern (mg, ml, mcg, units, IU).
 */
export function isValidDosage(dosage: string): boolean {
  return HAS_NUMERIC.test(dosage) && VALID_DOSAGE_UNITS.test(dosage);
}

/**
 * Determine the verified/unverified status of a medical entity based on
 * its Comprehend Medical confidence score.
 *
 * - confidence < 0.5 → flagged as "Unverified", verified = false
 * - confidence >= 0.5 → verified = true
 */
export function classifyEntityConfidence(confidence: number): {
  verified: boolean;
  status: 'Unverified' | null;
} {
  const isUnverified = confidence < 0.5;
  return {
    verified: !isUnverified,
    status: isUnverified ? 'Unverified' : null,
  };
}

/**
 * Assign a status label to a medical entity. Entities without an explicit
 * status from Comprehend Medical are labeled "Status not determined"
 * (never defaulting to "Normal").
 *
 * @param explicitStatus - The status from Comprehend Medical, or undefined/null if none.
 * @param confidence - The entity confidence score (0.0–1.0).
 * @returns The resolved status string.
 */
export function resolveEntityStatus(
  explicitStatus: string | undefined | null,
  confidence: number,
): string {
  if (confidence < 0.5) return 'Unverified';
  if (!explicitStatus || explicitStatus === 'Normal') return 'Status not determined';
  return explicitStatus;
}

/**
 * Determine whether the ocrFailed flag should be set based on Textract results.
 *
 * - If Textract threw an error → ocrFailed = true
 * - If Textract returned empty text → ocrFailed = true
 * - If Textract returned non-empty text → ocrFailed = false
 */
export function shouldSetOcrFailed(textractResult: {
  success: boolean;
  text: string;
}): boolean {
  if (!textractResult.success) return true;
  return !textractResult.text.trim();
}

/**
 * Validate that an in-app notification object has all required fields
 * for a document analysis alert stored in DynamoDB.
 *
 * Required fields: non-empty title, message, createdAt (ISO timestamp),
 * and sourceDocId.
 */
export function isValidNotification(notification: Record<string, unknown>): boolean {
  const { title, message, createdAt, sourceDocId } = notification;

  if (typeof title !== 'string' || title.trim().length === 0) return false;
  if (typeof message !== 'string' || message.trim().length === 0) return false;
  if (typeof sourceDocId !== 'string' || sourceDocId.trim().length === 0) return false;

  if (typeof createdAt !== 'string' || createdAt.trim().length === 0) return false;
  // Validate ISO 8601 timestamp format
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return false;

  return true;
}
