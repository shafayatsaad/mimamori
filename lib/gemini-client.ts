import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig } from './config-service';
import { getModelId, ModelRole } from './ai/model-registry';

// Initialize the Google Generative AI client using the API key from config-service
let genAIInstance: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAIInstance) {
    const config = getConfig();
    const apiKey = config.gemini.apiKey || process.env.GEMINI_API_KEY || '';
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

/**
 * Generate text content from a prompt using a logical model role.
 */
export async function generateText(
  prompt: string,
  role: ModelRole = 'orchestrator',
  temperature: number = 0.1
): Promise<string> {
  try {
    const client = getGeminiClient();
    const modelId = getModelId(role);
    const model = client.getGenerativeModel({
      model: modelId,
      generationConfig: { temperature },
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error(`Gemini generateText error [Role: ${role}]:`, error);
    throw error;
  }
}

/**
 * Generate text content using multimodal file input (e.g. image or PDF bytes).
 */
export async function generateWithFile(
  prompt: string,
  fileBuffer: Buffer,
  mimeType: string,
  role: ModelRole = 'orchestrator',
  temperature: number = 0.1
): Promise<string> {
  try {
    const client = getGeminiClient();
    const modelId = getModelId(role);
    const model = client.getGenerativeModel({
      model: modelId,
      generationConfig: { temperature },
    });

    const filePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType,
      },
    };

    const result = await model.generateContent([prompt, filePart]);
    return result.response.text();
  } catch (error) {
    console.error(`Gemini generateWithFile error [Role: ${role}, Mime: ${mimeType}]:`, error);
    throw error;
  }
}
