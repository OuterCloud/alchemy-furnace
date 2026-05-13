import "dotenv/config";

import crypto from "node:crypto";
import { Worker } from "bullmq";

import { embed } from "@/lib/ai/embedder";
import { db } from "@/lib/db";
import { QUEUE_NAMES, type EmbedJobData } from "@/lib/queue";
import { redis } from "@/lib/redis";
import { upsertChunk } from "@/lib/vector";

const worker = new Worker<EmbedJobData>(
  QUEUE_NAMES.EMBED,
  async (job) => {
    const { chunkId, knowledgeBaseId } = job.data;

    const chunk = await db.knowledgeChunk.findUniqueOrThrow({
      where: { id: chunkId },
      select: { content: true },
    });

    const vector = await embed(chunk.content);
    const qdrantId = crypto.randomUUID();

    await upsertChunk({
      qdrantId,
      vector,
      kbId: knowledgeBaseId,
      chunkId,
    });

    await db.knowledgeChunk.update({
      where: { id: chunkId },
      data: { qdrantId },
    });

    return { qdrantId };
  },
  { connection: redis, concurrency: 2 },
);

worker.on("failed", (job, error) => {
  console.error(`[EmbedWorker] Job ${job?.id} failed:`, error.message);
});

console.warn("[EmbedWorker] Started and listening for jobs...");
