import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

  const role = await db.role.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!role) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(role);
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

  const existing = await db.role.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    systemPrompt?: string;
    examples?: unknown;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    allowDataRequest?: boolean;
  };

  const role = await db.role.update({
    where: { id },
    data: {
      ...(body.name?.trim() && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() ?? null }),
      ...(body.systemPrompt !== undefined && { systemPrompt: body.systemPrompt.trim() }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(body.examples !== undefined && { examples: body.examples as any }),
      ...(body.status && { status: body.status }),
      ...(body.allowDataRequest !== undefined && { allowDataRequest: body.allowDataRequest }),
    },
  });

  return Response.json(role);
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

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return Response.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const existing = await db.role.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.role.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
