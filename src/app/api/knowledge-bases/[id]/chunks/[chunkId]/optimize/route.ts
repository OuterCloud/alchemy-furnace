import type { NextRequest } from "next/server";

import { optimizeChunk } from "@/lib/ai/knowledge-refiner";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; chunkId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
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

  const body = (await request.json()) as { instruction?: string };
  const optimized = await optimizeChunk(chunk.content, body.instruction);

  return Response.json({ content: optimized });
}
