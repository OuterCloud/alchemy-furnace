import { env } from "@/env";
import { QdrantClient } from "@qdrant/js-client-rest";

import { EMBED_DIM } from "@/lib/ai/embedder";

const COLLECTION = "skill_knowledge";

let client: QdrantClient | null = null;
let collectionReady = false;

function getClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: env.QDRANT_URL,
      ...(env.QDRANT_API_KEY && { apiKey: env.QDRANT_API_KEY }),
    });
  }
  return client;
}

async function ensureCollection(): Promise<void> {
  if (collectionReady) return;
  const c = getClient();
  try {
    await c.getCollection(COLLECTION);
  } catch {
    await c.createCollection(COLLECTION, {
      vectors: { size: EMBED_DIM, distance: "Cosine" },
    });
  }
  collectionReady = true;
}

export async function upsertChunk(params: {
  qdrantId: string;
  vector: number[];
  kbId: string;
  chunkId: string;
}): Promise<void> {
  await ensureCollection();
  const c = getClient();
  await c.upsert(COLLECTION, {
    points: [
      {
        id: params.qdrantId,
        vector: params.vector,
        payload: { kbId: params.kbId, chunkId: params.chunkId },
      },
    ],
  });
}

export async function searchChunks(params: {
  vector: number[];
  kbIds: string[];
  limit?: number;
}): Promise<Array<{ chunkId: string; score: number }>> {
  await ensureCollection();
  const c = getClient();
  const results = await c.search(COLLECTION, {
    vector: params.vector,
    limit: params.limit ?? 5,
    filter: {
      should: params.kbIds.map((kbId) => ({ key: "kbId", match: { value: kbId } })),
    },
    with_payload: true,
  });
  return results.map((r) => ({
    chunkId: (r.payload?.["chunkId"] as string) ?? "",
    score: r.score,
  }));
}

export async function deleteChunk(qdrantId: string): Promise<void> {
  await ensureCollection();
  const c = getClient();
  await c.delete(COLLECTION, { points: [qdrantId] });
}
