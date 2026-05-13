"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Archive,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  Globe,
  Link2,
  Link2Off,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RoleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface Example {
  input: string;
  output: string;
}

interface Chunk {
  id: string;
  content: string;
  qdrantId: string | null;
  createdAt: string;
}

interface AttachedKB {
  id: string;
  name: string;
  description: string | null;
  _count: { chunks: number };
}

interface AvailableKB {
  id: string;
  name: string;
  description: string | null;
  _count: { chunks: number };
}

// ── ChunkEditDialog ───────────────────────────────────────────────────────────

function ChunkEditDialog({
  chunk,
  idx,
  kbId,
  isArchived,
}: {
  chunk: Chunk;
  idx: number;
  kbId: string;
  isArchived: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editContent, setEditContent] = useState(chunk.content);
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (v) setEditContent(chunk.content);
    setOpen(v);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/chunks/${chunk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) throw new Error("保存失败");
      toast.success("已保存，重新向量化排队中");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = editContent !== chunk.content;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" />
        }
      >
        <Eye className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>知识块 {idx + 1}</DialogTitle>
          <DialogDescription>
            {formatDistanceToNow(new Date(chunk.createdAt), { addSuffix: true, locale: zhCN })}
            {" · "}
            {editContent.length} 字
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="min-h-[40vh] font-mono text-sm"
        />
        <DialogFooter>
          {!isArchived && (
            <Button onClick={handleSave} disabled={saving || !isDirty}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" />
                  保存中…
                </>
              ) : (
                "保存并重新向量化"
              )}
            </Button>
          )}
          <DialogClose render={<Button variant="outline" />}>关闭</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── AttachKBDialog ────────────────────────────────────────────────────────────

function AttachKBDialog({
  roleId,
  attachedKbIds,
  availableKBs,
  onAttached,
}: {
  roleId: string;
  attachedKbIds: Set<string>;
  availableKBs: AvailableKB[];
  onAttached: (kb: AvailableKB) => void;
}) {
  const [open, setOpen] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);

  const unattached = availableKBs.filter((kb) => !attachedKbIds.has(kb.id));

  const handleAttach = async (kbId: string) => {
    setAttaching(kbId);
    try {
      const res = await fetch(`/api/roles/${roleId}/knowledge-bases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeBaseId: kbId }),
      });
      if (!res.ok) throw new Error("挂载失败");
      const kb = availableKBs.find((k) => k.id === kbId)!;
      toast.success("知识库已挂载");
      setOpen(false);
      onAttached(kb);
    } catch {
      toast.error("挂载失败，请重试");
    } finally {
      setAttaching(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="h-4 w-4" />
        挂载知识库
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>选择知识库</DialogTitle>
          <DialogDescription>选择一个工作区知识库挂载到此角色</DialogDescription>
        </DialogHeader>
        {unattached.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-8">
            <BookOpen className="h-8 w-8 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">暂无可挂载的知识库</p>
              <p className="mt-1 text-xs text-muted-foreground">
                请先前往{" "}
                <Link
                  href="/knowledge"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  知识库
                </Link>{" "}
                模块新建
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {unattached.map((kb) => (
              <div
                key={kb.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{kb.name}</p>
                  {kb.description && (
                    <p className="truncate text-xs text-muted-foreground">{kb.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{kb._count.chunks} 个知识块</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAttach(kb.id)}
                  disabled={attaching === kb.id}
                  className="ml-3 shrink-0"
                >
                  {attaching === kb.id ? <Loader2 className="animate-spin" /> : <Link2 />}
                  挂载
                </Button>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>关闭</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RoleEditorProps {
  roleId: string;
  initialStatus: RoleStatus;
  canDelete: boolean;
  initialValues: {
    name: string;
    description: string;
    systemPrompt: string;
    examples: Example[];
    allowDataRequest: boolean;
  };
  attachedKBs: AttachedKB[];
  availableKBs: AvailableKB[];
}

export function RoleEditor({
  roleId,
  initialStatus,
  canDelete,
  initialValues,
  attachedKBs: initialAttachedKBs,
  availableKBs,
}: RoleEditorProps) {
  const router = useRouter();

  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const [systemPrompt, setSystemPrompt] = useState(initialValues.systemPrompt);
  const [examples, setExamples] = useState<Example[]>(initialValues.examples);
  const [allowDataRequest, setAllowDataRequest] = useState(initialValues.allowDataRequest);
  const [status, setStatus] = useState<RoleStatus>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [attachedKBs, setAttachedKBs] = useState<AttachedKB[]>(initialAttachedKBs);
  const [expandedKbId, setExpandedKbId] = useState<string | null>(null);
  const [kbChunks, setKbChunks] = useState<Record<string, Chunk[]>>({});
  const [loadingChunks, setLoadingChunks] = useState<string | null>(null);
  const [detachingKbId, setDetachingKbId] = useState<string | null>(null);
  const [deletingChunkId, setDeletingChunkId] = useState<string | null>(null);
  const [reembedding, setReembedding] = useState<string | null>(null);

  const isArchived = status === "ARCHIVED";
  const isDraft = status === "DRAFT";
  const isBusy = saving || transitioning;
  const attachedKbIds = new Set(attachedKBs.map((kb) => kb.id));

  // ── Examples helpers ──────────────────────────────────────────────────────

  const updateExample = (index: number, field: keyof Example, value: string) => {
    setExamples((prev) => prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex)));
  };
  const addExample = () => setExamples((prev) => [...prev, { input: "", output: "" }]);
  const removeExample = (index: number) =>
    setExamples((prev) => prev.filter((_, i) => i !== index));

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("名称不能为空");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${roleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, systemPrompt, examples, allowDataRequest }),
      });
      if (!res.ok) throw new Error("保存失败");
      toast.success("已保存");
      router.refresh();
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  // ── Status transitions ────────────────────────────────────────────────────

  const handleStatusChange = async (nextStatus: RoleStatus) => {
    if (nextStatus === "PUBLISHED" && !systemPrompt.trim()) {
      toast.error("请先填写系统提示词，不能发布空角色");
      return;
    }
    setTransitioning(true);
    try {
      const res = await fetch(`/api/roles/${roleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("操作失败");
      setStatus(nextStatus);
      const labels: Record<RoleStatus, string> = {
        PUBLISHED: "已发布",
        DRAFT: "已撤回为草稿",
        ARCHIVED: "已归档",
      };
      toast.success(labels[nextStatus]);
      router.refresh();
    } catch {
      toast.error("操作失败，请重试");
    } finally {
      setTransitioning(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/roles/${roleId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "删除失败");
      }
      toast.success("角色已删除");
      router.push("/roles");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败，请重试");
      setDeleting(false);
    }
  };

  // ── KB management ─────────────────────────────────────────────────────────

  const handleToggleKb = async (kbId: string) => {
    if (expandedKbId === kbId) {
      setExpandedKbId(null);
      return;
    }
    setExpandedKbId(kbId);
    if (!kbChunks[kbId]) {
      setLoadingChunks(kbId);
      try {
        const res = await fetch(`/api/knowledge-bases/${kbId}/chunks`);
        if (!res.ok) throw new Error("加载失败");
        const chunks = (await res.json()) as Chunk[];
        setKbChunks((prev) => ({ ...prev, [kbId]: chunks }));
      } catch {
        toast.error("加载知识块失败");
      } finally {
        setLoadingChunks(null);
      }
    }
  };

  const handleDetachKb = async (kbId: string) => {
    setDetachingKbId(kbId);
    try {
      const res = await fetch(`/api/roles/${roleId}/knowledge-bases/${kbId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("解除挂载失败");
      setAttachedKBs((prev) => prev.filter((kb) => kb.id !== kbId));
      if (expandedKbId === kbId) setExpandedKbId(null);
      toast.success("已解除挂载");
    } catch {
      toast.error("解除挂载失败，请重试");
    } finally {
      setDetachingKbId(null);
    }
  };

  const handleDeleteChunk = async (kbId: string, chunkId: string) => {
    setDeletingChunkId(chunkId);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/chunks/${chunkId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      setKbChunks((prev) => ({
        ...prev,
        [kbId]: (prev[kbId] ?? []).filter((c) => c.id !== chunkId),
      }));
      toast.success("知识块已删除");
    } catch {
      toast.error("删除失败，请重试");
    } finally {
      setDeletingChunkId(null);
    }
  };

  const handleReembed = async (kbId: string) => {
    setReembedding(kbId);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/reembed`, { method: "POST" });
      if (!res.ok) throw new Error("触发失败");
      const { requeued } = (await res.json()) as { requeued: number };
      toast.success(`已重新触发 ${requeued} 个知识块的向量化`);
    } catch {
      toast.error("触发向量化失败，请重试");
    } finally {
      setReembedding(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ── Archived banner ── */}
      {isArchived && (
        <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Archive className="h-4 w-4 shrink-0" />
          <span>此角色已归档，内容为只读。恢复为草稿后可继续编辑。</span>
        </div>
      )}

      {/* ── Basic fields ── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">名称</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="角色名称"
          disabled={isArchived}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">描述</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="这个角色解决什么问题？"
          className="min-h-16"
          disabled={isArchived}
        />
      </div>

      {/* ── System prompt ── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="systemPrompt">系统提示词</Label>
        <Textarea
          id="systemPrompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="定义角色的身份、思维方式和回答风格…"
          className="min-h-64 font-mono text-sm"
          disabled={isArchived}
        />
      </div>

      {/* ── Data request toggle ── */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">允许向用户索取数据</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            开启后，当 LLM 判断需要真实数据时，会主动告知用户应提供哪些具体数据
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={allowDataRequest}
          onClick={() => !isArchived && setAllowDataRequest((v) => !v)}
          disabled={isArchived}
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            isArchived ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          } ${allowDataRequest ? "bg-primary" : "bg-input"}`}
        >
          <span
            className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
              allowDataRequest ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* ── Examples ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>示例对话</Label>
          {!isArchived && (
            <Button variant="outline" size="sm" onClick={addExample}>
              <Plus />
              添加示例
            </Button>
          )}
        </div>
        {examples.map((ex, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">示例 {i + 1}</span>
              {!isArchived && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeExample(i)}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">用户输入</Label>
              <Input
                value={ex.input}
                onChange={(e) => updateExample(i, "input", e.target.value)}
                placeholder="用户会问…"
                disabled={isArchived}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">专家回答</Label>
              <Textarea
                value={ex.output}
                onChange={(e) => updateExample(i, "output", e.target.value)}
                placeholder="该专家会回答…"
                className="min-h-20"
                disabled={isArchived}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Action bar ── */}
      {isArchived ? (
        <Button
          variant="outline"
          onClick={() => handleStatusChange("DRAFT")}
          disabled={transitioning}
        >
          {transitioning ? (
            <>
              <Loader2 className="animate-spin" />
              恢复中…
            </>
          ) : (
            "恢复为草稿"
          )}
        </Button>
      ) : isDraft ? (
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSave} disabled={isBusy} className="flex-1">
            {saving ? "保存中…" : "保存草稿"}
          </Button>
          <Button
            onClick={() => handleStatusChange("PUBLISHED")}
            disabled={isBusy}
            className="flex-1"
          >
            {transitioning ? (
              <>
                <Loader2 className="animate-spin" />
                发布中…
              </>
            ) : (
              <>
                <Globe />
                发布
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={isBusy} className="flex-1">
            {saving ? "保存中…" : "保存"}
          </Button>
          <Button variant="outline" onClick={() => handleStatusChange("DRAFT")} disabled={isBusy}>
            {transitioning ? <Loader2 className="animate-spin" /> : "撤回草稿"}
          </Button>
          <Button variant="ghost" onClick={() => handleStatusChange("ARCHIVED")} disabled={isBusy}>
            {transitioning ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                <Archive />
                归档
              </>
            )}
          </Button>
        </div>
      )}

      {/* ── Knowledge Bases section ── */}
      <div className="rounded-xl border border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">挂载的知识库</span>
            <span className="text-xs text-muted-foreground">（{attachedKBs.length} 个）</span>
          </div>
          {!isArchived && (
            <AttachKBDialog
              roleId={roleId}
              attachedKbIds={attachedKbIds}
              availableKBs={availableKBs}
              onAttached={(kb) => {
                setAttachedKBs((prev) => [...prev, kb]);
                router.refresh();
              }}
            />
          )}
        </div>

        {attachedKBs.length === 0 ? (
          <div className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
            尚未挂载任何知识库。可在「知识库」模块创建知识库后挂载。
          </div>
        ) : (
          <div className="border-t border-border">
            {attachedKBs.map((kb) => {
              const isExpanded = expandedKbId === kb.id;
              const chunks = kbChunks[kb.id] ?? [];
              const hasPending = chunks.some((c) => !c.qdrantId);

              return (
                <div key={kb.id} className="border-b border-border last:border-b-0">
                  {/* KB header row */}
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button
                      type="button"
                      className="flex flex-1 cursor-pointer items-center gap-2 text-left"
                      onClick={() => handleToggleKb(kb.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{kb.name}</p>
                        <p className="text-xs text-muted-foreground">{kb._count.chunks} 个知识块</p>
                      </div>
                    </button>

                    {!isArchived && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDetachKb(kb.id)}
                        disabled={detachingKbId === kb.id}
                        title="解除挂载"
                      >
                        {detachingKbId === kb.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Link2Off className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Expanded chunks list */}
                  {isExpanded && (
                    <div className="bg-muted/20 px-4 pb-3">
                      {loadingChunks === kb.id ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          加载中…
                        </div>
                      ) : chunks.length === 0 ? (
                        <p className="py-4 text-sm text-muted-foreground">暂无知识块</p>
                      ) : (
                        <div className="flex flex-col gap-2 pt-2">
                          {hasPending && !isArchived && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-auto h-6 gap-1 px-2 text-xs text-muted-foreground"
                              onClick={() => handleReembed(kb.id)}
                              disabled={reembedding === kb.id}
                            >
                              {reembedding === kb.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              重新触发向量化
                            </Button>
                          )}
                          {chunks.map((chunk, idx) => (
                            <div
                              key={chunk.id}
                              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-muted-foreground">
                                  知识块 {idx + 1}
                                </p>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground/60">
                                    {formatDistanceToNow(new Date(chunk.createdAt), {
                                      addSuffix: true,
                                      locale: zhCN,
                                    })}
                                  </span>
                                  {chunk.qdrantId ? (
                                    <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                      已向量化
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                      待向量化
                                    </span>
                                  )}
                                </div>
                              </div>

                              <ChunkEditDialog
                                chunk={chunk}
                                idx={idx}
                                kbId={kb.id}
                                isArchived={isArchived}
                              />

                              {!isArchived && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteChunk(kb.id, chunk.id)}
                                  disabled={deletingChunkId === chunk.id}
                                >
                                  {deletingChunkId === chunk.id ? (
                                    <Loader2 className="animate-spin" />
                                  ) : (
                                    <Trash2 />
                                  )}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Danger zone ── */}
      {canDelete && (
        <div className="rounded-xl border border-destructive/30 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium">删除此角色</p>
                <p className="text-xs text-muted-foreground">
                  操作不可撤销，任何状态的角色均可删除。
                </p>
              </div>
            </div>
            <Dialog>
              <DialogTrigger
                render={<Button variant="destructive" size="sm" disabled={deleting} />}
              >
                {deleting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    删除中…
                  </>
                ) : (
                  "删除"
                )}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>确认删除「{name}」？</DialogTitle>
                  <DialogDescription>
                    此操作不可撤销。该角色及其所有对话记录将被永久删除。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
                  <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                    {deleting ? (
                      <>
                        <Loader2 className="animate-spin" />
                        删除中…
                      </>
                    ) : (
                      "确认删除"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </div>
  );
}
