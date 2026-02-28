export const NER_ENTITY_LABEL_MAP: Record<string, string> = {
  DX_NAME: 'Diagnosis',
  TIME_TO_DX_NAME: 'Timeline',
  TREATMENT_NAME: 'Treatment',
  TEST_NAME: 'Test',
  PROCEDURE_NAME: 'Procedure',
  ANATOMY: 'Anatomy',
  MEDICAL_CONDITION: 'Condition',
  MEDICATION: 'Medication',
  DOSAGE: 'Dosage',
  FREQUENCY: 'Frequency',
  DURATION: 'Duration',
  ROUTE_OR_MODE: 'Route',
  FORM: 'Form',
  STRENGTH: 'Strength',
};

export function getEntityLabel(entity: { Type?: string; Category?: string }): string {
  const raw = entity.Type || entity.Category || '';
  return NER_ENTITY_LABEL_MAP[raw] || raw;
}
