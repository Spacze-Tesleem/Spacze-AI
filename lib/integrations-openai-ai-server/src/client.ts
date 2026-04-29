import OpenAI from "openai";

// Supports any OpenAI-compatible endpoint.
// For local dev without a paid key, point at OpenRouter's free tier:
//   AI_INTEGRATIONS_OPENAI_BASE_URL=https://openrouter.ai/api/v1
//   AI_INTEGRATIONS_OPENAI_API_KEY=<your free openrouter key>
// On Replit the Replit AI proxy values are injected automatically.
if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_API_KEY must be set.",
  );
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://openrouter.ai/api/v1",
  defaultHeaders: {
    // OpenRouter requires these for rate-limit attribution; harmless elsewhere.
    "HTTP-Referer": "https://github.com/Spacze-Tesleem/Spacze-AI",
    "X-Title": "Spacze AI",
  },
});
