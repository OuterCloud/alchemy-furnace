import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { RoleEditor } from "@/components/role/role-editor";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "编辑角色" };

interface Example {
  input: string;
  output: string;
}

function parseExamples(raw: unknown): Example[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is Example =>
      typeof item === "object" &&
      item !== null &&
      "input" in item &&
      "output" in item &&
      typeof (item as Record<string, unknown>)["input"] === "string" &&
      typeof (item as Record<string, unknown>)["output"] === "string",
  );
}

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) notFound();

  const membership = await db.workspaceMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) notFound();

  const [role, attachedKBs, allKBs, attachedDSs, allDSs] = await Promise.all([
    db.role.findFirst({
      where: { id, workspaceId: membership.workspaceId },
    }),
    db.roleKnowledgeBase.findMany({
      where: { roleId: id },
      orderBy: { attachedAt: "asc" },
      include: {
        knowledgeBase: {
          include: { _count: { select: { chunks: true } } },
        },
      },
    }),
    db.knowledgeBase.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { chunks: true } } },
    }),
    db.roleDataSource.findMany({
      where: { roleId: id },
      include: { dataSource: true },
    }),
    db.dataSource.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!role) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button nativeButton={false} variant="ghost" size="icon-sm" render={<Link href="/roles" />}>
          <ChevronLeft />
          <span className="sr-only">返回</span>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{role.name}</h1>
          {role.description && (
            <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <RoleEditor
          roleId={role.id}
          initialStatus={role.status}
          canDelete={membership.role === "OWNER" || membership.role === "ADMIN"}
          initialValues={{
            name: role.name,
            description: role.description ?? "",
            systemPrompt: role.systemPrompt,
            examples: parseExamples(role.examples),
            allowDataRequest: role.allowDataRequest,
          }}
          attachedKBs={attachedKBs.map((a) => a.knowledgeBase)}
          availableKBs={allKBs}
          attachedDSs={attachedDSs.map((a) => a.dataSource)}
          availableDSs={allDSs}
        />
      </div>
    </div>
  );
}
