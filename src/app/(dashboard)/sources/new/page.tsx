import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { SourceEditor } from "@/components/sources/source-editor";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "新建数据源" };

export default function NewSourcePage() {
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
        <h1 className="text-2xl font-semibold">新建数据源</h1>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <SourceEditor />
      </div>
    </div>
  );
}
