// Server-only Google AI helper. Import only from .functions.ts handlers.
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function createGeminiProvider() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY (or GEMINI_API_KEY) is not set.");
  }
  return createGoogleGenerativeAI({ apiKey });
}
