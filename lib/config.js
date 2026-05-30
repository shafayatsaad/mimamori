// lib/config.js
export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  nvidiaApiKey: process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY,
  nodeEnv: process.env.NODE_ENV || 'production'
};

// Medical AI Model Configuration (Using GLM 5.1 and Qwen)
export const MEDICAL_MODELS = {
  micro: "z-ai/glm-5.1",
  orchestrator: "z-ai/glm-5.1",
  analyzer: "z-ai/glm-5.1",
  processor: "z-ai/glm-5.1",
  specialist: "z-ai/glm-5.1"
};

console.log('Configuration loaded successfully:', {
  supabaseUrl: config.supabaseUrl ? '✓' : '✗',
  nvidiaApiKey: config.nvidiaApiKey ? '✓' : '✗',
  nodeEnv: config.nodeEnv
});
