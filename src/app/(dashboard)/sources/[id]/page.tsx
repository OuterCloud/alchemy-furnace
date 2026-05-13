import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SourceEditor } from "@/components/sources/source-editor";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "编辑数据源" };

interface ParamDef {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

function parseParamSchema(raw: unknown): ParamDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ParamDef =>
      typeof item === "object" &&
      item !== null &&
      "name" in item &&
      typeof (item as Record<string, unknown>)["name"] === "string",
  );
}

function parseHeaders(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") result[k] = v;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) notFound();

  const membership = await db.workspaceMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) notFound();

  const ds = await db.dataSource.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!ds) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button
          nativeButton={false}
          variant="ghost"
          size="icon-sm"
          render={<Link href="/sources" />}
        >
          <ChevronLeft />
          <span className="sr-only">返回</span>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{ds.name}</h1>
          {ds.description && <p className="mt-1 text-sm text-muted-foreground">{ds.description}</p>}
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <SourceEditor
          initialData={{
            id: ds.id,
            name: ds.name,
            description: ds.description,
            method: ds.method,
            url: ds.url,
            headers: parseHeaders(ds.headers),
            paramSchema: parseParamSchema(ds.paramSchema),
          }}
        />
      </div>
    </div>
  );
}
