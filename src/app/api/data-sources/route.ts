import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
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

  const dataSources = await db.dataSource.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(dataSources);
}

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

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    method?: string;
    url?: string;
    headers?: unknown;
    paramSchema?: unknown;
  };

  if (!body.name?.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.url?.trim()) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  const ds = await db.dataSource.create({
    data: {
      workspaceId: membership.workspaceId,
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      method: body.method ?? "GET",
      url: body.url.trim(),
      headers: (body.headers as object) ?? null,
      paramSchema: (body.paramSchema as object) ?? [],
    },
  });

  return Response.json(ds, { status: 201 });
}
