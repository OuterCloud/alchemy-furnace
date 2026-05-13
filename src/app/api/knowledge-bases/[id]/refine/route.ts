import type { NextRequest } from "next/server";

import { expandForKnowledgeBase } from "@/lib/ai/knowledge-refiner";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { embedQueue } from "@/lib/queue";

type RouteContext = { params: Promise<{ id: string }> };

async function addChunk(knowledgeBaseId: string, content: string) {
  const chunk = await db.knowledgeChunk.create({
    data: { knowledgeBaseId, content },
  });
  embedQueue
    .add("embed-chunk", { chunkId: chunk.id, knowledgeBaseId })
    .catch((err: unknown) => console.error("[kb/refine] embed enqueue failed:", err));
  return chunk;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
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

  const body = (await request.json()) as { content?: string };
  const content = body.content?.trim();
  if (!content) {
    return Response.json({ error: "Content is required" }, { status: 400 });
  }

  const expandedContent = await expandForKnowledgeBase(content);
  const chunk = await addChunk(id, expandedContent);

  return Response.json({ chunkId: chunk.id, content: expandedContent }, { status: 201 });
}
