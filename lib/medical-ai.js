// lib/medical-ai.js
import { bedrockClient } from './aws-clients';
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { getModelId } from './ai/model-registry';

export class MedicalAI {
  
  // Document classification using Nova Micro
  static async classifyDocument(documentText) {
    try {
      const modelId = getModelId('micro');
      console.log('Classifying document with model:', modelId);
      
      const command = new ConverseCommand({
        modelId,
        messages: [
          {
            role: "user",
            content: [{
              text: `Classify this medical document. Return only the classification:

Document types: lab_report, prescription, medical_history, discharge_summary, imaging_report, consultation_note, other

Document: ${documentText.substring(0, 1000)}...

Classification:`
            }]
          }
        ],
        inferenceConfig: {
          maxTokens: 50,
          temperature: 0.1
        }
      });

      const response = await bedrockClient.send(command);
      return {
        success: true,
        classification: response.output.message.content[0].text.trim(),
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
        message: 'Bedrock connection successful',
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
    // Import comprehendMedicalClient here to avoid circular dependency
    const { comprehendMedicalClient } = await import('./aws-clients');
    const { DetectEntitiesV2Command } = await import('@aws-sdk/client-comprehendmedical');
    const command = new DetectEntitiesV2Command({ Text: text });
    const response = await comprehendMedicalClient.send(command);
    return response.Entities || [];
  },
  reason: async (prompt, modelId) => {
    const selectedModel = modelId || getModelId('orchestrator');
    const command = new ConverseCommand({
      modelId: selectedModel,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 1000, temperature: 0.1 }
    });
    const response = await bedrockClient.send(command);
    return response.output?.message?.content?.[0]?.text || '';
  }
};
