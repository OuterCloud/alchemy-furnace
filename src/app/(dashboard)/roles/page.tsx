import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { RoleCard } from "@/components/role/role-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "角色" };

export default async function RolesPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const membership = userId
    ? await db.workspaceMember.findFirst({
        where: { userId },
        orderBy: { joinedAt: "asc" },
      })
    : null;

  const roles = membership
    ? await db.role.findMany({
        where: { workspaceId: membership.workspaceId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Latest conversation per role for this user (only needed for PUBLISHED roles)
  const publishedIds = roles.filter((r) => r.status === "PUBLISHED").map((r) => r.id);
  const latestConversations =
    userId && publishedIds.length > 0
      ? await db.conversation.findMany({
          where: { userId, roleId: { in: publishedIds } },
          orderBy: { updatedAt: "desc" },
          distinct: ["roleId"],
          select: { id: true, roleId: true },
        })
      : [];

  const latestByRole = Object.fromEntries(latestConversations.map((c) => [c.roleId, c.id]));

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">角色</h1>
          <p className="mt-1 text-sm text-muted-foreground">创建可部署的 AI 对话角色，挂载知识库</p>
        </div>
        <Button nativeButton={false} render={<Link href="/roles/new" />}>
          <Plus />
          新建角色
        </Button>
      </div>

      {roles.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
          <Bot className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium">还没有任何角色</p>
            <p className="mt-1 text-sm text-muted-foreground">
              创建一个 AI 对话角色，定义身份和行为
            </p>
          </div>
          <Button nativeButton={false} render={<Link href="/roles/new" />}>
            <Plus />
            新建第一个角色
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              latestConversationId={latestByRole[role.id] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
