import type { Metadata } from "next";
import { Construction } from "lucide-react";

export const metadata: Metadata = { title: "数据源" };

export default function SourcesPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
      <Construction className="h-10 w-10 opacity-40" />
      <p className="text-sm">敬请期待</p>
    </div>
  );
}
