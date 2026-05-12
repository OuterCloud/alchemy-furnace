import { env } from "@/env";
import OpenAI from "openai";

/**
 * OpenAI-compatible client pointing to the internal LLM bridge.
 * Use this singleton for all LLM interactions in the application.
 */
export const llm = new OpenAI({
  baseURL: env.LLM_BASE_URL,
  apiKey: env.LLM_API_KEY,
});

export const DEFAULT_MODEL = env.LLM_MODEL;
