import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; kbId: string }> };

/** DELETE — detach a KB from a role */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, kbId } = await params;
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

  await db.roleKnowledgeBase.deleteMany({
    where: { roleId: id, knowledgeBaseId: kbId },
  });

  return new Response(null, { status: 204 });
}
