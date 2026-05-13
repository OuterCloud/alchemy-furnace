import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

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

  const body = (await request.json()) as { dataSourceId?: string };
  if (!body.dataSourceId) {
    return Response.json({ error: "dataSourceId is required" }, { status: 400 });
  }

  const ds = await db.dataSource.findFirst({
    where: { id: body.dataSourceId, workspaceId: membership.workspaceId },
  });
  if (!ds) {
    return Response.json({ error: "Data source not found" }, { status: 404 });
  }

  const attachment = await db.roleDataSource.upsert({
    where: { roleId_dataSourceId: { roleId: id, dataSourceId: body.dataSourceId } },
    create: { roleId: id, dataSourceId: body.dataSourceId },
    update: {},
  });

  return Response.json(attachment, { status: 201 });
}
