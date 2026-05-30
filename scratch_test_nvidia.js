const { OpenAI } = require('openai');
require('dotenv').config({ path: '.env.local' });

async function test() {
  const apiKey = process.env.NVIDIA_API_KEY;
  console.log("NVIDIA_API_KEY:", apiKey ? "FOUND" : "NOT FOUND");
  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });

  try {
    console.log("Fetching models...");
    const models = await openai.models.list();
    console.log("Available models:");
    for (const m of models.data) {
      console.log("- " + m.id);
    }
  } catch (err) {
    console.error("Error listing models:", err);
  }

  try {
    console.log("\nTesting text completion with z-ai/glm-5.1...");
    const res = await openai.chat.completions.create({
      model: 'z-ai/glm-5.1',
      messages: [{ role: 'user', content: 'Say hello!' }],
      max_tokens: 10,
    });
    console.log("Response:", res.choices[0].message.content);
  } catch (err) {
    console.error("Error testing z-ai/glm-5.1:", err.message);
  }
}

test();
