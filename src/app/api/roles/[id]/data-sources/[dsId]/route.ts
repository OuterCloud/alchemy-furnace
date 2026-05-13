import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; dsId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, dsId } = await params;
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

  await db.roleDataSource.deleteMany({
    where: { roleId: id, dataSourceId: dsId },
  });

  return new Response(null, { status: 204 });
}
