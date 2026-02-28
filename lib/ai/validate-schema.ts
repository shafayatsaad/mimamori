import { z } from 'zod';

// --- Zod Schemas ---

const probeItemSchema = z.object({
  question: z.string().min(1),
  title: z.string().min(1),
});

const probeResponseSchema = z.array(probeItemSchema).length(5);
const followupProbeResponseSchema = z.array(probeItemSchema).min(1).max(5);

const visitPrepResponseSchema = z.string().min(1);

const fileAnalysisResponseSchema = z.object({
  summary: z.string().min(1),
  actualType: z.string().min(1),
});

// --- Exported Types ---

export type ProbeItem = z.infer<typeof probeItemSchema>;
export type FileAnalysis = z.infer<typeof fileAnalysisResponseSchema>;

// --- Validation Functions ---

export function validateProbeResponse(
  raw: unknown
): { valid: true; data: ProbeItem[] } | { valid: false; error: string } {
  const result = probeResponseSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, error: result.error.message };
}

export function validateFollowupProbeResponse(
  raw: unknown
): { valid: true; data: ProbeItem[] } | { valid: false; error: string } {
  const result = followupProbeResponseSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, error: result.error.message };
}

export function validateVisitPrepResponse(
  raw: unknown
): { valid: true; data: string } | { valid: false; error: string } {
  const result = visitPrepResponseSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, error: result.error.message };
}

export function validateFileAnalysisResponse(
  raw: unknown
): { valid: true; data: FileAnalysis } | { valid: false; error: string } {
  const result = fileAnalysisResponseSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, error: result.error.message };
}
