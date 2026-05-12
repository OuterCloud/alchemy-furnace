import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { DEFAULT_MODEL, llm } from "./client";

export interface RefinedSkill {
  name: string;
  description: string;
  systemPrompt: string;
  examples: Array<{ user: string; assistant: string }>;
  metadata: {
    domain: string;
    tags: string[];
    useCases: string[];
  };
}

const REFINE_SYSTEM_PROMPT = `You are an expert AI skill architect. Your task is to analyze the provided source material and distill it into a structured AI skill definition.

A "skill" is a reusable AI persona/assistant definition that captures specific expertise, reasoning patterns, and communication style from the source material.

You must respond with valid JSON matching this schema exactly:
{
  "name": "string — concise skill name (max 50 chars)",
  "description": "string — what this skill does and who it's for (max 200 chars)",
  "systemPrompt": "string — the complete system prompt that makes an LLM embody this skill",
  "examples": [
    { "user": "string — example user message", "assistant": "string — ideal response" }
  ],
  "metadata": {
    "domain": "string — primary domain (e.g. Investment Analysis, Quantitative Research)",
    "tags": ["string"],
    "useCases": ["string — specific scenarios where this skill is useful"]
  }
}

Guidelines for systemPrompt:
- Capture the expert's unique perspective, frameworks, and mental models
- Include specific terminology and analytical approaches from the source
- Define the persona's communication style and depth of analysis
- Be specific and actionable, not generic`;

export async function refineSourceToSkill(
  sourceContent: string,
  instruction?: string,
): Promise<RefinedSkill> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: REFINE_SYSTEM_PROMPT },
    {
      role: "user",
      content: instruction
        ? `Source material:\n\n${sourceContent}\n\nAdditional instruction: ${instruction}`
        : `Source material:\n\n${sourceContent}`,
    },
  ];

  const response = await llm.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  return JSON.parse(content) as RefinedSkill;
}

export async function adjustSkill(
  currentSkill: { systemPrompt: string; examples: unknown },
  instruction: string,
): Promise<Pick<RefinedSkill, "systemPrompt" | "examples">> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are an expert AI skill architect. You will receive an existing skill definition and an adjustment instruction.

Respond with valid JSON containing only the updated fields:
{
  "systemPrompt": "string — updated system prompt",
  "examples": [{ "user": "string", "assistant": "string" }]
}`,
    },
    {
      role: "user",
      content: `Current skill:\n${JSON.stringify(currentSkill, null, 2)}\n\nAdjustment instruction: ${instruction}`,
    },
  ];

  const response = await llm.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  return JSON.parse(content) as Pick<RefinedSkill, "systemPrompt" | "examples">;
}
