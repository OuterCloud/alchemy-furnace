import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { embedQueue } from "@/lib/queue";
import { deleteChunk } from "@/lib/vector";

type RouteContext = { params: Promise<{ id: string; chunkId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
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

  if (chunk.qdrantId) {
    await deleteChunk(chunk.qdrantId).catch((err: unknown) =>
      console.error("[chunks/delete] Qdrant delete failed:", err),
    );
  }

  await db.knowledgeChunk.delete({ where: { id: chunkId } });

  return new Response(null, { status: 204 });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, chunkId } = await params;
  const body = (await request.json()) as { content?: string; title?: string };
  const content = body.content?.trim();
  const title = body.title?.trim();

  if (!content && title === undefined) {
    return Response.json({ error: "content or title is required" }, { status: 400 });
  }

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

  // Only re-embed when content changes
  if (content && chunk.qdrantId) {
    await deleteChunk(chunk.qdrantId).catch((err: unknown) =>
      console.error("[chunks/put] Qdrant delete failed:", err),
    );
  }

  const updateData: { content?: string; title?: string | null; qdrantId?: null } = {};
  if (content) {
    updateData.content = content;
    updateData.qdrantId = null;
  }
  if (title !== undefined) {
    updateData.title = title || null;
  }

  const updated = await db.knowledgeChunk.update({
    where: { id: chunkId },
    data: updateData,
  });

  if (content) {
    embedQueue
      .add("embed-chunk", { chunkId: updated.id, knowledgeBaseId: id })
      .catch((err: unknown) => console.error("[chunks/put] embed enqueue failed:", err));
  }

  return Response.json(updated);
}
