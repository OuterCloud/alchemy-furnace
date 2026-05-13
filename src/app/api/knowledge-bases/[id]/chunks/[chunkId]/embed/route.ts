import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { embedQueue } from "@/lib/queue";

type RouteContext = { params: Promise<{ id: string; chunkId: string }> };

/** POST — manually trigger embedding for a single chunk */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, chunkId } = await params;
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) {
    return Response.json({ error: "No workspace" }, { status: 403 });
  }

  const chunk = await db.knowledgeChunk.findFirst({
    where: {
      id: chunkId,
      knowledgeBaseId: id,
      knowledgeBase: { workspaceId: membership.workspaceId },
    },
  });
  if (!chunk) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await embedQueue.add("embed-chunk", { chunkId, knowledgeBaseId: id });

  return Response.json({ queued: true });
}
