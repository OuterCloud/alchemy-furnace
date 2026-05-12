import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables — never exposed to the browser.
   */
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Database
    DATABASE_URL: z.string().url(),

    // Auth
    AUTH_SECRET: z.string().min(32),
    AUTH_WECHAT_ID: z.string().optional(),
    AUTH_WECHAT_SECRET: z.string().optional(),
    AUTH_FEISHU_ID: z.string().optional(),
    AUTH_FEISHU_SECRET: z.string().optional(),

    // LLM
    LLM_BASE_URL: z.string().url(),
    LLM_API_KEY: z.string().min(1),
    LLM_MODEL: z.string().default("gpt-4o"),

    // Redis
    REDIS_URL: z.string().url(),

    // Qdrant
    QDRANT_URL: z.string().url(),
    QDRANT_API_KEY: z.string().optional(),

    // Storage
    STORAGE_ENDPOINT: z.string().url().optional(),
    STORAGE_ACCESS_KEY_ID: z.string().optional(),
    STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
    STORAGE_BUCKET_NAME: z.string().default("alchemy-furnace"),
  },

  /**
   * Client-side environment variables — must be prefixed with NEXT_PUBLIC_.
   */
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_STORAGE_PUBLIC_URL: z.string().url().optional(),
  },

  /**
   * Destructure all variables here for type-safety.
   * Must match the server/client keys exactly.
   */
  runtimeEnv: {
    NODE_ENV: process.env["NODE_ENV"],
    DATABASE_URL: process.env["DATABASE_URL"],
    AUTH_SECRET: process.env["AUTH_SECRET"],
    AUTH_WECHAT_ID: process.env["AUTH_WECHAT_ID"],
    AUTH_WECHAT_SECRET: process.env["AUTH_WECHAT_SECRET"],
    AUTH_FEISHU_ID: process.env["AUTH_FEISHU_ID"],
    AUTH_FEISHU_SECRET: process.env["AUTH_FEISHU_SECRET"],
    LLM_BASE_URL: process.env["LLM_BASE_URL"],
    LLM_API_KEY: process.env["LLM_API_KEY"],
    LLM_MODEL: process.env["LLM_MODEL"],
    REDIS_URL: process.env["REDIS_URL"],
    QDRANT_URL: process.env["QDRANT_URL"],
    QDRANT_API_KEY: process.env["QDRANT_API_KEY"],
    STORAGE_ENDPOINT: process.env["STORAGE_ENDPOINT"],
    STORAGE_ACCESS_KEY_ID: process.env["STORAGE_ACCESS_KEY_ID"],
    STORAGE_SECRET_ACCESS_KEY: process.env["STORAGE_SECRET_ACCESS_KEY"],
    STORAGE_BUCKET_NAME: process.env["STORAGE_BUCKET_NAME"],
    NEXT_PUBLIC_APP_URL: process.env["NEXT_PUBLIC_APP_URL"],
    NEXT_PUBLIC_STORAGE_PUBLIC_URL: process.env["NEXT_PUBLIC_STORAGE_PUBLIC_URL"],
  },

  skipValidation: !!process.env["SKIP_ENV_VALIDATION"],
  emptyStringAsUndefined: true,
});
