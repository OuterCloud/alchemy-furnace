import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteChunk } from "@/lib/vector";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
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
    include: { _count: { select: { chunks: true } } },
  });
  if (!kb) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(kb);
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
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

  const body = (await request.json()) as { name?: string; description?: string };
  const name = body.name?.trim();
  if (name !== undefined && !name) {
    return Response.json({ error: "名称不能为空" }, { status: 400 });
  }

  const updated = await db.knowledgeBase.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(body.description !== undefined && { description: body.description.trim() || null }),
    },
  });

  return Response.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
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
    include: { chunks: { select: { qdrantId: true } } },
  });
  if (!kb) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Remove all Qdrant vectors for this KB
  await Promise.allSettled(
    kb.chunks.filter((c) => c.qdrantId).map((c) => deleteChunk(c.qdrantId!)),
  );

  await db.knowledgeBase.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
