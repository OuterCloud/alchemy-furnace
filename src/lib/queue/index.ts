import { Queue } from "bullmq";

import { redis } from "@/lib/redis";

export const QUEUE_NAMES = {
  REFINE: "refine",
  EMBED: "embed",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface RefineJobData {
  jobId: string;
  sourceId: string;
  workspaceId: string;
  createdById: string;
  instruction?: string;
}

export interface EmbedJobData {
  skillId: string;
  workspaceId: string;
}

export const refineQueue = new Queue<RefineJobData>(QUEUE_NAMES.REFINE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const embedQueue = new Queue<EmbedJobData>(QUEUE_NAMES.EMBED, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});
