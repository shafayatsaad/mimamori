import OpenAI from 'openai';
import { getConfig } from './config-service';
import { ModelRole } from './ai/model-registry';

// Initialize the OpenAI client pointing to Nvidia's integrate API baseURL
let openaiInstance: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    const config = getConfig();
    const apiKey = config.gemini.apiKey || process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY || '';
    const baseURL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
    openaiInstance = new OpenAI({
      apiKey,
      baseURL,
    });
  }
  return openaiInstance;
}

// Keep this name for legacy compatibility with local tests/mocking
export function getGeminiClient(): any {
  return getOpenAIClient();
}

/**
 * Generate text content from a prompt using a logical model role (via Nvidia GLM 5.1).
 */
export async function generateText(
  prompt: string,
  role: ModelRole = 'orchestrator',
  temperature: number = 0.1
): Promise<string> {
  try {
    const client = getOpenAIClient();
    
    // We use z-ai/glm-5.1 as requested by the user for reasoning tasks
    const model = 'z-ai/glm-5.1';

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error(`Nvidia GLM generateText error [Role: ${role}]:`, error);
    throw error;
  }
}

/**
 * Generate text content using multimodal file input (via Nvidia Qwen vision model).
 */
export async function generateWithFile(
  prompt: string,
  fileBuffer: Buffer,
  mimeType: string,
  role: ModelRole = 'orchestrator',
  temperature: number = 0.1
): Promise<string> {
  try {
    const client = getOpenAIClient();
    
    // We use qwen/qwen3.5-397b-a17b as the primary multimodal model
    const model = 'qwen/qwen3.5-397b-a17b';
    
    const base64Data = fileBuffer.toString('base64');
    
    // Qwen VL accepts image data URIs. If not an image, default to image/jpeg payload container format
    const formattedMime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${formattedMime};base64,${base64Data}`,
              },
            },
          ],
        },
      ],
      temperature,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error(`Nvidia Qwen generateWithFile error [Role: ${role}, Mime: ${mimeType}]:`, error);
    throw error;
  }
}
