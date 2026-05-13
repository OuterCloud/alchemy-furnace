import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "数据源" };

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  POST: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PUT: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  PATCH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default async function SourcesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) notFound();

  const membership = await db.workspaceMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });

  const dataSources = membership
    ? await db.dataSource.findMany({
        where: { workspaceId: membership.workspaceId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">数据源</h1>
        <Button nativeButton={false} render={<Link href="/sources/new" />}>
          <Plus className="h-4 w-4" />
          新建数据源
        </Button>
      </div>

      {dataSources.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-16">
          <div className="text-center">
            <p className="text-sm font-medium">暂无数据源</p>
            <p className="mt-1 text-xs text-muted-foreground">
              数据源允许角色通过 function calling 按需拉取实时数据
            </p>
          </div>
          <Button nativeButton={false} variant="outline" render={<Link href="/sources/new" />}>
            <Plus className="h-4 w-4" />
            新建数据源
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dataSources.map((ds) => (
            <Link
              key={ds.id}
              href={`/sources/${ds.id}`}
              className="flex cursor-pointer flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${METHOD_COLORS[ds.method] ?? "bg-muted text-muted-foreground"}`}
                >
                  {ds.method}
                </span>
                <p className="truncate text-sm font-medium">{ds.name}</p>
              </div>
              {ds.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{ds.description}</p>
              )}
              <p className="truncate font-mono text-xs text-muted-foreground/70">{ds.url}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
