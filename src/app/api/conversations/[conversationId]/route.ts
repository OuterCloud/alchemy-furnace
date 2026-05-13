import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

// PATCH /api/conversations/[conversationId] — rename title
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { conversationId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { title?: string };
  const title = body.title?.trim() ?? "";

  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, userId: session.user.id },
  });
  if (!conversation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.conversation.update({
    where: { id: conversationId },
    data: { title: title || null },
  });

  return Response.json({ id: updated.id, title: updated.title });
}

// DELETE /api/conversations/[conversationId]
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { conversationId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, userId: session.user.id },
  });
  if (!conversation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.conversation.delete({ where: { id: conversationId } });

  return new Response(null, { status: 204 });
}
