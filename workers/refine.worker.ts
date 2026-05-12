import "dotenv/config";

import { Worker } from "bullmq";

import { refineSourceToSkill } from "@/lib/ai/refine";
import { db } from "@/lib/db";
import { QUEUE_NAMES, type RefineJobData } from "@/lib/queue";
import { redis } from "@/lib/redis";

const worker = new Worker<RefineJobData>(
  QUEUE_NAMES.REFINE,
  async (job) => {
    const { jobId, sourceId, workspaceId, createdById, instruction } = job.data;

    // Mark job as processing
    await db.refinementJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING", progress: 10 },
    });

    // Fetch source material
    const source = await db.sourceMaterial.findUniqueOrThrow({
      where: { id: sourceId },
    });

    if (!source.content) {
      throw new Error(`Source ${sourceId} has no content to refine`);
    }

    await db.refinementJob.update({
      where: { id: jobId },
      data: { progress: 30 },
    });

    // Call LLM to refine
    const refined = await refineSourceToSkill(source.content, instruction);

    await db.refinementJob.update({
      where: { id: jobId },
      data: { progress: 70 },
    });

    // Persist the new skill
    const skill = await db.skill.create({
      data: {
        name: refined.name,
        description: refined.description,
        systemPrompt: refined.systemPrompt,
        examples: refined.examples,
        metadata: refined.metadata,
        workspaceId,
        createdById,
      },
    });

    // Save initial version snapshot
    await db.skillVersion.create({
      data: {
        skillId: skill.id,
        version: 1,
        systemPrompt: refined.systemPrompt,
        examples: refined.examples,
        changeNote: "Initial version from source refinement",
        createdById,
      },
    });

    // Mark job complete
    await db.refinementJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        skillId: skill.id,
        result: { skillId: skill.id },
      },
    });

    return { skillId: skill.id };
  },
  { connection: redis, concurrency: 5 },
);

worker.on("failed", async (job, error) => {
  console.error(`[RefineWorker] Job ${job?.id} failed:`, error.message);

  if (job?.data.jobId) {
    await db.refinementJob
      .update({
        where: { id: job.data.jobId },
        data: {
          status: "FAILED",
          error: error.message,
        },
      })
      .catch(console.error);
  }
});

console.warn("[RefineWorker] Started and listening for jobs...");
