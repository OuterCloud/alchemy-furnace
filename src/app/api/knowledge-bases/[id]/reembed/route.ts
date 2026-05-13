import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { embedQueue } from "@/lib/queue";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) {
    return Response.json({ error: "No workspace" }, { status: 403 });
  }

  const kb = await db.knowledgeBase.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!kb) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const pending = await db.knowledgeChunk.findMany({
    where: { knowledgeBaseId: id, qdrantId: null },
    select: { id: true },
  });

  await Promise.all(
    pending.map((chunk) =>
      embedQueue
        .add("embed-chunk", { chunkId: chunk.id, knowledgeBaseId: id })
        .catch((err: unknown) =>
          console.error("[reembed] enqueue failed for chunk", chunk.id, err),
        ),
    ),
  );

  return Response.json({ requeued: pending.length });
}
