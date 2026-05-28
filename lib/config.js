// lib/config.js
export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  nodeEnv: process.env.NODE_ENV || 'production'
};

// Medical AI Model Configuration
export const MEDICAL_MODELS = {
  micro: "gemini-2.0-flash-lite",
  orchestrator: "gemini-2.0-flash",
  analyzer: "gemini-2.0-flash",
  processor: "gemini-2.0-flash",
  specialist: "gemini-2.0-flash"
};

console.log('Configuration loaded successfully:', {
  supabaseUrl: config.supabaseUrl ? '✓' : '✗',
  geminiApiKey: config.geminiApiKey ? '✓' : '✗',
  nodeEnv: config.nodeEnv
});
