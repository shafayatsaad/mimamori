/**
 * Prompt Template Store
 *
 * Manages medical AI prompt templates with interpolation support.
 * Falls back to built-in defaults when no DB template exists.
 * All rendered prompts include the shared SYSTEM_GUARDRAIL constant.
 */

import { SYSTEM_GUARDRAIL } from './guardrails';

export type PromptType = 'default-analysis' | 'visit-prep' | 'generate-probes' | 'generate-personalized-probes' | 'generate-followup-probes' | 'generate-recommendation' | 'export-summary';

const RELEVANCE_INSTRUCTION =
  'Generate questions relevant only to the patient\'s documented conditions and recent log entries. ' +
  'Do not generate questions about conditions the patient has not reported.';

const INSIGHT_INSTRUCTION =
  'Report only correlations supported by the provided log data. ' +
  'Do not infer causation. Do not predict diagnoses.';

const DEFAULT_TEMPLATES: Record<PromptType, string> = {
  'default-analysis':
    'Analyze the following patient daily logs and analyzed medical documents holistically. ' +
    'Generate a very short 1-sentence AI correlation insight or prediction that synthesizes both. ' +
    'Start the sentence with "Based on your recent logs and documents, your highest...".\n\n' +
    '{{guardrail}}\n\n' +
    INSIGHT_INSTRUCTION + '\n\n' +
    'Logs: {{logs}}\nDocuments: {{documents}}',

  'visit-prep':
    'Based on these recent logs and medical document analyses, generate ONE highly relevant and specific question ' +
    'the patient should ask their doctor during their next visit. Also provide a 1-2 sentence \'Context\' explaining ' +
    'why this question is important based on the holistic evidence from logs and documents.\n\n' +
    '{{guardrail}}\n\n' +
    RELEVANCE_INSTRUCTION + '\n\n' +
    'Patient conditions: {{conditions}}\nPatient allergies: {{allergies}}\n\n' +
    'Return ONLY a JSON object with this exact format: {"question": "...", "context": "..."}. Do not include markdown wraps.\n' +
    'Logs: {{logs}}\nDocuments: {{documents}}',

  'generate-probes':
    'Generate EXACTLY 5 general daily health check-in questions ("probes") for a patient.\n\n' +
    'RULES:\n' +
    '- These are general wellness questions that apply to any patient regardless of their history.\n' +
    '- Include questions about: (1) Blood Pressure, (2) Sleep quality/duration, (3) Medication adherence, ' +
    '(4) Energy level, (5) Pain or discomfort.\n' +
    '- Each question should have 3 clear, specific answer options.\n' +
    '- Options should use concrete values when possible (e.g. "7-9 hours" not "Good").\n\n' +
    '{{guardrail}}\n\n' +
    'Patient conditions: {{conditions}}\nPatient allergies: {{allergies}}\n\n' +
    'Return ONLY a JSON array with exactly 5 objects. Format: ' +
    '[{"title": "Short Context (e.g., \'Blood Pressure\', \'Sleep Quality\')", "question": "The actual question", ' +
    '"options": ["Option 1", "Option 2", "Option 3"]}]. Do not include markdown wraps.',

  'generate-personalized-probes':
    'Based on these recent patient logs, prior probe answers, and analyzed medical documents, ' +
    'generate 3-5 personalized health questions ("probes") tailored to THIS specific patient.\n\n' +
    'RULES:\n' +
    '- Every probe MUST be directly motivated by something found in the patient\'s logs or documents.\n' +
    '- Focus on patterns, concerns, or conditions that appear in their data (e.g. recurring symptoms, ' +
    'abnormal test results, lifestyle factors mentioned in logs, medication side effects from documents).\n' +
    '- Do NOT generate generic wellness questions — those are handled separately.\n' +
    '- Do NOT ask about blood pressure, sleep, medication adherence, energy, or pain in general terms — ' +
    'only ask about these if the patient\'s data shows a specific concern (e.g. "Your last 3 logs mention headaches after lunch — have you noticed a pattern?").\n' +
    '- Each question should have 3 specific, assumptive answer options based on what the data suggests.\n' +
    '- If there are no logs or documents to base questions on, return an empty JSON array [].\n\n' +
    '{{guardrail}}\n\n' +
    RELEVANCE_INSTRUCTION + '\n\n' +
    'Patient conditions: {{conditions}}\nPatient allergies: {{allergies}}\n\n' +
    'Return ONLY a JSON array (3-5 objects, or empty [] if no data). Format: ' +
    '[{"title": "Short Context", "question": "The personalized question", ' +
    '"options": ["Option 1", "Option 2", "Option 3"]}]. Do not include markdown wraps.\n' +
    'Logs: {{logs}}\nDocuments: {{documents}}',

  'generate-followup-probes':
    'The patient has answered the following health probes in this conversation session:\n\n{{extraContext}}\n\n' +
    'Based on their FULL answer history above, generate targeted follow-up questions to pinpoint the source of any suffering.\n\n' +
    'RULES:\n' +
    '- NEVER re-ask a question the patient already answered above. Review ALL answers carefully.\n' +
    '- Generate follow-up probes ONLY if an answer indicates a concern (e.g. high BP, poor sleep, missed medication, moderate-to-severe pain, very low energy).\n' +
    '- Be ASSUMPTIVE: if the patient reports poor sleep, don\'t ask "did you sleep poorly?" — instead ask about likely causes like "Was it pain, anxiety, or needing to use the bathroom that kept you up?"\n' +
    '- Each follow-up should narrow down the specific cause or severity of the concern.\n' +
    '- Generate 1-2 follow-up probes maximum. Fewer is better. Only ask what\'s clinically necessary.\n' +
    '- If ALL answers are normal/healthy, or if the concerns have been sufficiently explored, return an empty JSON array [].\n' +
    '- Options should be specific and assumptive (e.g. "Headache", "Dizziness", "Chest tightness") not vague (e.g. "Yes", "No", "Maybe").\n\n' +
    '{{guardrail}}\n\n' +
    RELEVANCE_INSTRUCTION + '\n\n' +
    'Patient conditions: {{conditions}}\nPatient allergies: {{allergies}}\n\n' +
    'Return ONLY a JSON array (may be empty). Format: ' +
    '[{"title": "Short Context", "question": "The follow-up question", ' +
    '"options": ["Option 1", "Option 2", "Option 3"]}]. Return [] if no follow-up is needed. Do not include markdown wraps.\n' +
    'Recent logs: {{logs}}\nDocuments: {{documents}}',

  'generate-recommendation':
    'The patient just completed their daily health probes. Here are all their answers from today:\n\n{{extraContext}}\n\n' +
    'Based on their answers and recent health history, generate a brief, actionable health recommendation.\n\n' +
    'RULES:\n' +
    '- If any answers indicate a concern (high BP, poor sleep, missed medication, pain, low energy), provide a specific, ' +
    'practical recommendation addressing the most important concern.\n' +
    '- Keep it to 1-2 sentences. Be warm and supportive, not alarming.\n' +
    '- If ALL answers are normal/healthy, provide a brief positive reinforcement message (e.g. "Great job staying on track today!").\n' +
    '- Do NOT diagnose. Do NOT prescribe. Recommend consulting their doctor for anything serious.\n\n' +
    '{{guardrail}}\n\n' +
    'Patient conditions: {{conditions}}\nPatient allergies: {{allergies}}\n\n' +
    'Return ONLY a JSON object: {"recommendation": "Your message here", "severity": "good|info|warning"}.\n' +
    '- "good" = everything looks fine, positive reinforcement\n' +
    '- "info" = mild suggestion, nothing urgent\n' +
    '- "warning" = something needs attention, recommend consulting doctor\n' +
    'Do not include markdown wraps.\n' +
    'Recent logs: {{logs}}\nDocuments: {{documents}}',

  'export-summary':
    'Generate a comprehensive, well-structured visit preparation summary for a patient\'s upcoming doctor appointment. ' +
    'The summary should be written in plain language suitable for sharing with a healthcare provider.\n\n' +
    'Include these sections:\n' +
    '1. PATIENT OVERVIEW — Name (if available), known conditions, allergies\n' +
    '2. RECENT SYMPTOMS & OBSERVATIONS — Key symptoms, vitals, and patterns from recent daily logs\n' +
    '3. MEDICATIONS & ADHERENCE — Any medications mentioned in logs or documents\n' +
    '4. KEY FINDINGS FROM DOCUMENTS — Notable results from analyzed medical documents\n' +
    '5. TRENDS & CONCERNS — Patterns or changes worth discussing with the doctor\n' +
    '6. SUGGESTED DISCUSSION POINTS — 3-5 specific questions or topics for the appointment\n\n' +
    '{{guardrail}}\n\n' +
    INSIGHT_INSTRUCTION + '\n\n' +
    'Patient conditions: {{conditions}}\nPatient allergies: {{allergies}}\n\n' +
    '{{extraContext}}\n\n' +
    'Format the output as clean readable text with section headers. Do not use markdown. Do not wrap in JSON.\n' +
    'Logs: {{logs}}\nDocuments: {{documents}}',
};


/**
 * Returns the shared medical guardrail text that must be included in all prompts.
 */
export function getGuardrailText(): string {
  return SYSTEM_GUARDRAIL;
}

/**
 * Returns the prompt template for the given type.
 * Falls back to built-in defaults (DB lookup can be added later).
 */
export function getPromptTemplate(type: PromptType): string {
  return DEFAULT_TEMPLATES[type];
}

/**
 * Renders a prompt by interpolating {{logs}}, {{documents}}, {{guardrail}},
 * {{conditions}}, and {{allergies}} markers, then ensures the guardrail text
 * is always present.
 */
export function renderPrompt(
  type: PromptType,
  data: {
    logs: any[];
    documents: any[];
    conditions?: string[];
    allergies?: string[];
    extraContext?: string;
  },
): string {
  const template = getPromptTemplate(type);

  const conditionsText = data.conditions?.length
    ? data.conditions.join(', ')
    : 'None documented';
  const allergiesText = data.allergies?.length
    ? data.allergies.join(', ')
    : 'None documented';
  const extraContextText = data.extraContext || '';

  let rendered = template
    .replace(/\{\{logs\}\}/g, () => JSON.stringify(data.logs))
    .replace(/\{\{documents\}\}/g, () => JSON.stringify(data.documents || []))
    .replace(/\{\{guardrail\}\}/g, () => SYSTEM_GUARDRAIL)
    .replace(/\{\{conditions\}\}/g, () => conditionsText)
    .replace(/\{\{allergies\}\}/g, () => allergiesText)
    .replace(/\{\{extraContext\}\}/g, () => extraContextText);

  // Ensure guardrail is always present even if template didn't include {{guardrail}}
  if (!rendered.includes(SYSTEM_GUARDRAIL)) {
    rendered += '\n\n' + SYSTEM_GUARDRAIL;
  }

  return rendered;
}
