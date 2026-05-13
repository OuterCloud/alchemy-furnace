import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

async function getDataSourceWithAuth(id: string, userId: string) {
  const membership = await db.workspaceMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) return { error: "No workspace", status: 403 } as const;

  const ds = await db.dataSource.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!ds) return { error: "Not found", status: 404 } as const;

  return { ds, membership };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await getDataSourceWithAuth(id, session.user.id);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });

  return Response.json(result.ds);
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await getDataSourceWithAuth(id, session.user.id);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    method?: string;
    url?: string;
    headers?: unknown;
    paramSchema?: unknown;
  };

  if (body.name !== undefined && !body.name.trim()) {
    return Response.json({ error: "name cannot be empty" }, { status: 400 });
  }
  if (body.url !== undefined && !body.url.trim()) {
    return Response.json({ error: "url cannot be empty" }, { status: 400 });
  }

  const updated = await db.dataSource.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description.trim() || null }),
      ...(body.method !== undefined && { method: body.method }),
      ...(body.url !== undefined && { url: body.url.trim() }),
      ...(body.headers !== undefined && { headers: (body.headers as object) ?? null }),
      ...(body.paramSchema !== undefined && { paramSchema: (body.paramSchema as object) ?? [] }),
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
  const result = await getDataSourceWithAuth(id, session.user.id);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });

  await db.dataSource.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
