"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function StartConversationButton({
  roleId,
  latestConversationId,
}: {
  roleId: string;
  latestConversationId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    // Navigate to most recent conversation if one exists
    if (latestConversationId) {
      router.push(`/conversations/${latestConversationId}`);
      return;
    }

    // No prior conversation — create a new one
    setLoading(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      if (!res.ok) throw new Error("创建失败");
      const { id } = (await res.json()) as { id: string };
      router.push(`/conversations/${id}`);
    } catch {
      toast.error("创建对话失败，请重试");
      setLoading(false);
    }
  };

  return (
    <Button className="w-full" disabled={loading} onClick={handleStart}>
      {loading ? "创建中..." : "开始对话"}
    </Button>
  );
}
