import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "知识库" };

export default async function KnowledgePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const membership = userId
    ? await db.workspaceMember.findFirst({
        where: { userId },
        orderBy: { joinedAt: "asc" },
      })
    : null;

  const kbs = membership
    ? await db.knowledgeBase.findMany({
        where: { workspaceId: membership.workspaceId },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { chunks: true } } },
      })
    : [];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">知识库</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理工作区知识库，向量化内容供角色检索使用
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/knowledge/new" />}>
          <Plus />
          新建知识库
        </Button>
      </div>

      {kbs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium">还没有任何知识库</p>
            <p className="mt-1 text-sm text-muted-foreground">
              创建知识库，输入专业知识，AI 会将其向量化用于检索
            </p>
          </div>
          <Button nativeButton={false} render={<Link href="/knowledge/new" />}>
            <Plus />
            新建第一个知识库
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kbs.map((kb) => (
            <Link key={kb.id} href={`/knowledge/${kb.id}`} className="block cursor-pointer">
              <Card className="transition-all hover:ring-primary/30">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                    <CardTitle>{kb.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {kb.description && (
                    <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
                      {kb.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{kb._count.chunks} 个知识块</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
