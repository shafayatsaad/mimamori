/**
 * Pure validation functions for API request bodies.
 *
 * Each function returns either a success result or a failure result with
 * a 400-level error describing the missing/invalid field.
 */

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string; status: number };

/**
 * Validates the /api/medical-reasoning request body.
 * Requires `logs` to be a non-empty array.
 */
export function validateMedicalReasoningRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Missing required field: logs', status: 400 };
  }
  const b = body as Record<string, unknown>;
  if (!b.logs || !Array.isArray(b.logs)) {
    return { valid: false, error: 'Missing required field: logs', status: 400 };
  }
  return { valid: true };
}

/**
 * Validates the /api/send-alert request body.
 * Requires `email` to be a non-empty string.
 */
export function validateSendAlertRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Missing required field: email', status: 400 };
  }
  const b = body as Record<string, unknown>;
  if (!b.email || typeof b.email !== 'string' || b.email.trim() === '') {
    return { valid: false, error: 'Missing required field: email', status: 400 };
  }
  return { valid: true };
}

/**
 * Validates the /api/analyze-file request body.
 * Requires `fileUrl` to be a non-empty string.
 */
export function validateAnalyzeFileRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Missing required field: fileUrl', status: 400 };
  }
  const b = body as Record<string, unknown>;
  if (!b.fileUrl || typeof b.fileUrl !== 'string' || b.fileUrl.trim() === '') {
    return { valid: false, error: 'Missing required field: fileUrl', status: 400 };
  }
  return { valid: true };
}

/**
 * Validates the /api/sync POST request body.
 * Requires `email` to be a non-empty string.
 */
export function validateSyncRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Missing required field: email', status: 400 };
  }
  const b = body as Record<string, unknown>;
  if (!b.email || typeof b.email !== 'string' || b.email.trim() === '') {
    return { valid: false, error: 'Missing required field: email', status: 400 };
  }
  return { valid: true };
}
