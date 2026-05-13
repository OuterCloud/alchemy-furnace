import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChatWindow } from "@/components/chat/chat-window";

export const metadata: Metadata = { title: "对话" };

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const { conversationId } = await params;
  const session = await auth();

  if (!session?.user?.id) notFound();

  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, userId: session.user.id },
    include: {
      role: { select: { name: true, systemPrompt: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) notFound();

  // All conversations this user has had with the same role (for history panel)
  const roleConversations = await db.conversation.findMany({
    where: { roleId: conversation.roleId, userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      messages: {
        where: { role: "USER" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  return (
    <ChatWindow
      conversationId={conversation.id}
      roleId={conversation.roleId}
      role={{ name: conversation.role.name }}
      initialMessages={conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        imageUrls: m.imageUrls ? (JSON.parse(m.imageUrls) as string[]) : null,
        createdAt: m.createdAt.toISOString(),
      }))}
      roleConversations={roleConversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
        firstUserMessage: c.messages[0]?.content ?? null,
      }))}
    />
  );
}
