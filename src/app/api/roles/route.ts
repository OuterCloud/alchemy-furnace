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

  const roles = await db.role.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(roles);
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
    systemPrompt?: string;
    examples?: unknown;
  };

  const { name, description, systemPrompt, examples } = body;
  if (!name?.trim()) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const role = await db.role.create({
    data: {
      name: name.trim(),
      description: description?.trim() ?? null,
      systemPrompt: systemPrompt?.trim() ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      examples: (examples as any) ?? null,
      workspaceId: membership.workspaceId,
      createdById: session.user.id,
    },
  });

  return Response.json(role, { status: 201 });
}
