import OpenAI from 'openai';
import { getConfig } from './config-service';
import { ModelRole } from './ai/model-registry';
import crypto from 'crypto';

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

// --- In-memory response cache to avoid duplicate API calls for identical prompts ---
interface CacheEntry {
  response: string;
  timestamp: number;
}

const RESPONSE_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX_SIZE = 50;

function getCacheKey(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex').substring(0, 16);
}

function getCachedResponse(prompt: string): string | null {
  const key = getCacheKey(prompt);
  const entry = RESPONSE_CACHE.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    console.log(`[ai-cache] Cache HIT for key ${key}`);
    return entry.response;
  }
  if (entry) RESPONSE_CACHE.delete(key); // expired
  return null;
}

function setCachedResponse(prompt: string, response: string): void {
  // Evict oldest entries if cache is full
  if (RESPONSE_CACHE.size >= CACHE_MAX_SIZE) {
    const oldestKey = RESPONSE_CACHE.keys().next().value;
    if (oldestKey) RESPONSE_CACHE.delete(oldestKey);
  }
  RESPONSE_CACHE.set(getCacheKey(prompt), { response, timestamp: Date.now() });
}

/**
 * Generate text content from a prompt using a logical model role (via Nvidia GLM 5.1).
 * Includes response caching and max_tokens to avoid wasteful long outputs.
 */
export async function generateText(
  prompt: string,
  role: ModelRole = 'orchestrator',
  temperature: number = 0.1,
  maxTokens: number = 2048
): Promise<string> {
  // Check cache first
  const cached = getCachedResponse(prompt);
  if (cached) return cached;

  try {
    const client = getOpenAIClient();
    
    // We use z-ai/glm-5.1 as requested by the user for reasoning tasks
    const model = 'z-ai/glm-5.1';

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    });

    const result = completion.choices[0]?.message?.content || '';
    setCachedResponse(prompt, result);
    return result;
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
      max_tokens: 4096,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error(`Nvidia Qwen generateWithFile error [Role: ${role}, Mime: ${mimeType}]:`, error);
    throw error;
  }
}
