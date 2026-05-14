import { env } from "@/env";
import OpenAI from "openai";

/**
 * OpenAI-compatible LLM client.
 * Supports any OpenAI-compatible endpoint (OpenAI, Groq, Azure OpenAI, Ollama, etc.).
 * Use this singleton for all LLM interactions in the application.
 */
export const llm = new OpenAI({
  baseURL: env.LLM_BASE_URL,
  apiKey: env.LLM_API_KEY,
});

export const DEFAULT_MODEL = env.LLM_MODEL;
