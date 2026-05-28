// lib/medical-ai.js
import { generateText } from './gemini-client';
import { getModelId } from './ai/model-registry';

export class MedicalAI {
  
  // Document classification using Gemini Micro
  static async classifyDocument(documentText) {
    try {
      const modelId = getModelId('micro');
      console.log('Classifying document with Gemini model:', modelId);
      
      const prompt = `Classify this medical document. Return only the classification. Do not add any punctuation or explanatory text.

Document types: lab_report, prescription, medical_history, discharge_summary, imaging_report, consultation_note, other

Document: ${documentText.substring(0, 1000)}...

Classification:`;

      const response = await generateText(prompt, 'micro');
      return {
        success: true,
        classification: response.trim(),
        model: modelId
      };
    } catch (error) {
      console.error('Document classification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Test connection
  static async testConnection() {
    try {
      const testResult = await this.classifyDocument("Patient has diabetes and takes insulin daily.");
      return {
        success: true,
        message: 'Gemini connection successful',
        testResult
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Backward-compatible exports for existing API routes
export const medicalAi = {
  analyze: async (text) => {
    try {
      const prompt = `Analyze the following medical text and extract medical entities in a structured JSON format.
Identify entities falling into these exact categories and attributes:
1. Category: "MEDICATION"
   - Text: name of the medication
   - Attributes: Type: "DOSAGE" (e.g. "500mg", "10ml"), Type: "FREQUENCY" (e.g. "once daily", "twice a day")
2. Category: "TEST_TREATMENT_PROCEDURE"
   - Text: name of the test or procedure
   - Attributes: Type: "TEST_VALUE" (e.g. "120", "normal"), Type: "TEST_UNIT" (e.g. "mg/dL", "mmHg")
3. Category: "MEDICAL_CONDITION"
   - Text: name of the medical condition

Return a JSON object containing a single key "Entities" which is an array of objects. Each entity object MUST have the following structure:
{
  "Category": "MEDICATION" | "TEST_TREATMENT_PROCEDURE" | "MEDICAL_CONDITION",
  "Text": string,
  "Score": number,
  "Attributes": Array<{ "Type": "DOSAGE" | "FREQUENCY" | "TEST_VALUE" | "TEST_UNIT", "Text": string }>
}

Do not include any markdown formatting, explainers, or backticks around the JSON. Only return valid raw JSON text.

Medical Text:
${text}`;

      const response = await generateText(prompt, 'orchestrator');
      const cleanText = response.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanText);
      return parsed.Entities || [];
    } catch (error) {
      console.error('Gemini medical entity extraction error:', error);
      return [];
    }
  },
  
  reason: async (prompt, modelId) => {
    // Bedrock ConverseCommand replacement
    return await generateText(prompt, 'orchestrator');
  }
};
