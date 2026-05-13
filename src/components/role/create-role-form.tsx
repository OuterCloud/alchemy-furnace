"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateRoleForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("请填写角色名称");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });

      if (!res.ok) throw new Error("创建失败");
      const created = (await res.json()) as { id: string };
      router.push(`/roles/${created.id}`);
    } catch {
      toast.error("创建失败，请重试");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">角色名称</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如：量化策略分析师、产品需求评审专家"
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
          placeholder="简短描述这个角色解决什么问题"
          className="min-h-16"
        />
      </div>

      <Button onClick={handleCreate} disabled={saving || !name.trim()}>
        {saving ? "创建中..." : "创建角色"}
      </Button>
    </div>
  );
}
