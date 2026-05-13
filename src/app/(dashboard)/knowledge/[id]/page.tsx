import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { KnowledgeBaseEditor } from "@/components/knowledge/kb-editor";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "知识库" };

export default async function KnowledgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) notFound();

  const membership = await db.workspaceMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) notFound();

  const kb = await db.knowledgeBase.findFirst({
    where: { id, workspaceId: membership.workspaceId },
    include: {
      chunks: {
        orderBy: { createdAt: "desc" },
        select: { id: true, content: true, qdrantId: true, createdAt: true },
      },
    },
  });
  if (!kb) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button
          nativeButton={false}
          variant="ghost"
          size="icon-sm"
          render={<Link href="/knowledge" />}
        >
          <ChevronLeft />
          <span className="sr-only">返回</span>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{kb.name}</h1>
          {kb.description && <p className="mt-1 text-sm text-muted-foreground">{kb.description}</p>}
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <KnowledgeBaseEditor
          kbId={kb.id}
          kbName={kb.name}
          kbDescription={kb.description ?? ""}
          initialChunks={kb.chunks.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
          }))}
          canDelete={membership.role === "OWNER" || membership.role === "ADMIN"}
        />
      </div>
    </div>
  );
}
