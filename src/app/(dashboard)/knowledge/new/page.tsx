"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewKnowledgePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("请填写知识库名称");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });

      if (!res.ok) throw new Error("创建失败");
      const created = (await res.json()) as { id: string };
      router.push(`/knowledge/${created.id}`);
    } catch {
      toast.error("创建失败，请重试");
      setSaving(false);
    }
  };

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
          <h1 className="text-2xl font-semibold">新建知识库</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            命名知识库，之后在详情页输入内容进行炼化
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">知识库名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：缠论核心方法论、产品设计原则"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">
              描述
              <span className="ml-1 font-normal text-muted-foreground">（可选）</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简短描述这个知识库包含哪类内容"
              className="min-h-16"
            />
          </div>

          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "创建中..." : "创建知识库"}
          </Button>
        </div>
      </div>
    </div>
  );
}
