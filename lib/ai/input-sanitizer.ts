/**
 * Input Sanitizer
 *
 * Strips prompt injection patterns from user-supplied text before
 * embedding in AI prompts. Logs original vs sanitized length for
 * audit purposes without logging actual content.
 */

export interface SanitizeResult {
  text: string;
  originalLength: number;
  sanitizedLength: number;
  wasModified: boolean;
}

/**
 * Prompt injection patterns to strip (case-insensitive).
 * Covers system instruction overrides and role reassignment attempts.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore previous instructions/gi,
  /you are now/gi,
  /system:/gi,
];

/** Matches XML/HTML tags including self-closing tags. */
const XML_HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9]*\b[^>]*\/?>/gi;

/** Matches more than 3 consecutive newlines. */
const EXCESSIVE_NEWLINES_PATTERN = /\n{4,}/g;

/**
 * Sanitizes user-supplied text for safe embedding in AI prompts.
 *
 * Strips:
 * - "ignore previous instructions", "you are now", "system:" (case-insensitive)
 * - XML/HTML tags
 * - Excessive whitespace (>3 consecutive newlines → 2 newlines)
 *
 * Logs original vs sanitized length for audit (never logs content).
 */
export function sanitizeForPrompt(input: string): SanitizeResult {
  const originalLength = input.length;

  let text = input;

  // Strip prompt injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    text = text.replace(pattern, '');
  }

  // Strip XML/HTML tags
  text = text.replace(XML_HTML_TAG_PATTERN, '');

  // Collapse excessive whitespace (>3 consecutive newlines → 2 newlines)
  text = text.replace(EXCESSIVE_NEWLINES_PATTERN, '\n\n');

  const sanitizedLength = text.length;
  const wasModified = originalLength !== sanitizedLength;

  if (wasModified) {
    console.log(
      `[InputSanitizer] Sanitized input: originalLength=${originalLength}, sanitizedLength=${sanitizedLength}`,
    );
  }

  return { text, originalLength, sanitizedLength, wasModified };
}
