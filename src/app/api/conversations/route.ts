import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) {
    return Response.json({ error: "No workspace" }, { status: 403 });
  }

  const body = (await request.json()) as { roleId?: string };
  const { roleId } = body;

  if (!roleId) {
    return Response.json({ error: "roleId is required" }, { status: 400 });
  }

  // Verify role is in the workspace and published
  const role = await db.role.findFirst({
    where: { id: roleId, workspaceId: membership.workspaceId, status: "PUBLISHED" },
  });
  if (!role) {
    return Response.json({ error: "Role not found or not published" }, { status: 404 });
  }

  const conversation = await db.conversation.create({
    data: { roleId, userId: session.user.id },
  });

  return Response.json({ id: conversation.id }, { status: 201 });
}
