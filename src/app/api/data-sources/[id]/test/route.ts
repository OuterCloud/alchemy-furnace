import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { callDataSource } from "@/lib/data-source/caller";
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

  const ds = await db.dataSource.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!ds) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as { args?: Record<string, unknown> };
  const args = body.args ?? {};

  try {
    const result = await callDataSource(
      { method: ds.method, url: ds.url, headers: ds.headers, paramSchema: ds.paramSchema },
      args,
    );
    return Response.json({ result });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 },
    );
  }
}
