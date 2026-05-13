import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — list KBs attached to a role */
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

  const role = await db.role.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!role) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const attachments = await db.roleKnowledgeBase.findMany({
    where: { roleId: id },
    orderBy: { attachedAt: "asc" },
    include: {
      knowledgeBase: {
        include: { _count: { select: { chunks: true } } },
      },
    },
  });

  return Response.json(attachments.map((a) => a.knowledgeBase));
}

/** POST — attach a KB to a role */
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

  const role = await db.role.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!role) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as { knowledgeBaseId?: string };
  if (!body.knowledgeBaseId) {
    return Response.json({ error: "knowledgeBaseId is required" }, { status: 400 });
  }

  const kb = await db.knowledgeBase.findFirst({
    where: { id: body.knowledgeBaseId, workspaceId: membership.workspaceId },
  });
  if (!kb) {
    return Response.json({ error: "Knowledge base not found" }, { status: 404 });
  }

  const attachment = await db.roleKnowledgeBase.upsert({
    where: { roleId_knowledgeBaseId: { roleId: id, knowledgeBaseId: body.knowledgeBaseId } },
    create: { roleId: id, knowledgeBaseId: body.knowledgeBaseId },
    update: {},
  });

  return Response.json(attachment, { status: 201 });
}
