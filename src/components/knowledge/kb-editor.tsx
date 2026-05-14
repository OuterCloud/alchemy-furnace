"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  BrainCircuit,
  Eye,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
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

interface Chunk {
  id: string;
  title: string | null;
  content: string;
  qdrantId: string | null;
  createdAt: string;
}

// ── ChunkEditDialog ───────────────────────────────────────────────────────────

function ChunkEditDialog({
  chunk,
  idx,
  kbId,
  onSaved,
}: {
  chunk: Chunk;
  idx: number;
  kbId: string;
  onSaved: (chunkId: string, newContent: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editContent, setEditContent] = useState(chunk.content);
  const [instruction, setInstruction] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setEditContent(chunk.content);
      setInstruction("");
    }
    setOpen(v);
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/chunks/${chunk.id}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: instruction.trim() || undefined }),
      });
      if (!res.ok) throw new Error("优化失败");
      const { content } = (await res.json()) as { content: string };
      setEditContent(content);
      toast.success("AI 优化完成，确认后点保存");
    } catch {
      toast.error("优化失败，请重试");
    } finally {
      setOptimizing(false);
    }
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
      onSaved(chunk.id, editContent);
      setOpen(false);
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = editContent !== chunk.content;
  const isBusy = optimizing || saving;
  const displayTitle = chunk.title ?? `知识块 ${idx + 1}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" />
        }
      >
        <Eye className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{displayTitle}</DialogTitle>
          <DialogDescription>
            {formatDistanceToNow(new Date(chunk.createdAt), { addSuffix: true, locale: zhCN })}
            {" · "}
            {editContent.length} 字
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="max-h-[40vh] min-h-[150px] resize-none font-mono text-sm"
          disabled={isBusy}
        />

        {/* AI 优化区域 */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">AI 优化</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="优化指令（可选，如：补充操作步骤、精简冗余内容…）"
              className="h-8 text-xs"
              disabled={isBusy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isBusy) handleOptimize();
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleOptimize}
              disabled={isBusy}
              className="shrink-0"
            >
              {optimizing ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {optimizing ? "优化中…" : "AI 优化"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isBusy || !isDirty}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" />
                保存中…
              </>
            ) : (
              "保存并重新向量化"
            )}
          </Button>
          <DialogClose render={<Button variant="outline" />}>关闭</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── InlineTitle ───────────────────────────────────────────────────────────────

function InlineTitle({
  chunk,
  idx,
  kbId,
  onSaved,
}: {
  chunk: Chunk;
  idx: number;
  kbId: string;
  onSaved: (chunkId: string, title: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayTitle = chunk.title ?? `知识块 ${idx + 1}`;

  const startEdit = () => {
    setDraft(chunk.title ?? "");
    setEditing(true);
    // focus after render
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveTitle = async () => {
    const newTitle = draft.trim() || null;
    // No change
    if (newTitle === chunk.title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setEditing(false);
    const prev = chunk.title;
    onSaved(chunk.id, newTitle); // optimistic
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/chunks/${chunk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle ?? "" }),
      });
      if (!res.ok) throw new Error();
    } catch {
      onSaved(chunk.id, prev); // revert
      toast.error("标题保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") saveTitle();
          if (e.key === "Escape") cancelEdit();
        }}
        onBlur={saveTitle}
        placeholder={`知识块 ${idx + 1}`}
        className="h-5 w-full rounded border border-border bg-background px-1 text-sm font-medium outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <div className="group/title flex min-w-0 items-center gap-1">
      {saving ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : null}
      <p
        className="cursor-pointer truncate text-sm font-medium"
        onClick={startEdit}
        title="点击编辑标题"
      >
        {displayTitle}
      </p>
      <button
        onClick={startEdit}
        className="shrink-0 cursor-pointer opacity-0 transition-opacity group-hover/title:opacity-100"
        title="编辑标题"
      >
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}

// ── KnowledgeBaseEditor ───────────────────────────────────────────────────────

interface KnowledgeBaseEditorProps {
  kbId: string;
  kbName: string;
  kbDescription: string;
  initialChunks: Chunk[];
  canDelete: boolean;
}

export function KnowledgeBaseEditor({
  kbId,
  kbName,
  kbDescription,
  initialChunks,
  canDelete,
}: KnowledgeBaseEditorProps) {
  const router = useRouter();

  const [name, setName] = useState(kbName);
  const [description, setDescription] = useState(kbDescription);
  const [saving, setSaving] = useState(false);

  const [chunks, setChunks] = useState<Chunk[]>(initialChunks);
  const [refineContent, setRefineContent] = useState("");
  const [refining, setRefining] = useState(false);
  const [deletingChunkId, setDeletingChunkId] = useState<string | null>(null);
  const [embeddingChunkId, setEmbeddingChunkId] = useState<string | null>(null);
  const [reembedding, setReembedding] = useState(false);
  const [deletingKB, setDeletingKB] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("名称不能为空");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
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

  const hasPending = chunks.some((c) => !c.qdrantId);

  const handleRefine = async () => {
    if (!refineContent.trim()) {
      toast.error("请先输入要炼化的内容");
      return;
    }
    setRefining(true);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: refineContent }),
      });
      if (!res.ok) throw new Error("炼化失败");
      const data = (await res.json()) as { chunkId: string; content: string; title?: string };
      setRefineContent("");
      setChunks((prev) => [
        {
          id: data.chunkId,
          title: data.title ?? null,
          content: data.content,
          qdrantId: null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      toast.success("已炼化并存入知识库，正在向量化…");
    } catch {
      toast.error("炼化失败，请重试");
    } finally {
      setRefining(false);
    }
  };

  const handleDeleteChunk = async (chunkId: string) => {
    setDeletingChunkId(chunkId);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/chunks/${chunkId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      setChunks((prev) => prev.filter((c) => c.id !== chunkId));
      toast.success("知识块已删除");
    } catch {
      toast.error("删除失败，请重试");
    } finally {
      setDeletingChunkId(null);
    }
  };

  const handleEmbedChunk = async (chunkId: string) => {
    setEmbeddingChunkId(chunkId);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/chunks/${chunkId}/embed`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("触发失败");
      toast.success("已加入向量化队列，请确保 Worker 正在运行");
    } catch {
      toast.error("触发向量化失败，请重试");
    } finally {
      setEmbeddingChunkId(null);
    }
  };

  const handleReembed = async () => {
    setReembedding(true);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/reembed`, { method: "POST" });
      if (!res.ok) throw new Error("触发失败");
      const { requeued } = (await res.json()) as { requeued: number };
      toast.success(`已重新触发 ${requeued} 个知识块的向量化，请确保 Worker 正在运行`);
    } catch {
      toast.error("触发向量化失败，请重试");
    } finally {
      setReembedding(false);
    }
  };

  const handleDeleteKB = async () => {
    setDeletingKB(true);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      toast.success("知识库已删除");
      router.push("/knowledge");
    } catch {
      toast.error("删除失败，请重试");
      setDeletingKB(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    setUploadFileName(file.name);
    setUploadingPdf(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "上传失败");
      }
      const data = (await res.json()) as {
        count: number;
        chunks: Chunk[];
      };
      setChunks((prev) => [...data.chunks, ...prev]);
      toast.success(`已从 PDF 提取 ${data.count} 个知识块，正在向量化…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败，请重试");
    } finally {
      setUploadingPdf(false);
      setUploadFileName(null);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Basic fields ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kb-name">名称</Label>
          <Input
            id="kb-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="知识库名称"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kb-description">描述</Label>
          <Textarea
            id="kb-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="这个知识库存储了什么内容？"
            className="min-h-16"
          />
        </div>
        <Button variant="outline" onClick={handleSave} disabled={saving} className="self-end">
          {saving ? (
            <>
              <Loader2 className="animate-spin" />
              保存中…
            </>
          ) : (
            "保存"
          )}
        </Button>
      </div>

      {/* ── Refine input ── */}
      <div className="rounded-xl border border-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">炼化并存入知识库</span>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refineContent">知识内容</Label>
            <Textarea
              id="refineContent"
              value={refineContent}
              onChange={(e) => setRefineContent(e.target.value)}
              placeholder="粘贴或输入专业知识、操作手册、经验总结……AI 会将其整理为结构化知识块并向量化"
              className="min-h-40"
              disabled={refining}
            />
          </div>
          <Button onClick={handleRefine} disabled={refining || !refineContent.trim()}>
            {refining ? (
              <>
                <Loader2 className="animate-spin" />
                炼化中…
              </>
            ) : (
              <>
                <Sparkles />
                炼化并存入知识库
              </>
            )}
          </Button>

          {/* PDF upload divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">或</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* PDF upload button */}
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            disabled={uploadingPdf}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePdfUpload(file);
            }}
          />
          <Button
            variant="outline"
            onClick={() => pdfInputRef.current?.click()}
            disabled={uploadingPdf || refining}
            className="w-full"
          >
            {uploadingPdf ? (
              <>
                <Loader2 className="animate-spin" />
                {uploadFileName ? `正在处理「${uploadFileName}」…` : "处理中…"}
              </>
            ) : (
              <>
                <FileText />
                上传 PDF 文件炼化
              </>
            )}
          </Button>
          {uploadingPdf && (
            <p className="text-center text-xs text-muted-foreground">
              正在提取文本并逐段 AI 炼化，PDF 较大时需要一些时间…
            </p>
          )}
        </div>
      </div>

      {/* ── Chunks list ── */}
      {chunks.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">知识块</span>
            <span className="text-xs text-muted-foreground">（{chunks.length} 块）</span>
            {hasPending && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 gap-1 px-2 text-xs text-muted-foreground"
                onClick={handleReembed}
                disabled={reembedding}
              >
                {reembedding ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                全部重新向量化
              </Button>
            )}
          </div>
          {chunks.map((chunk, idx) => (
            <div key={chunk.id} className="rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <InlineTitle
                    chunk={chunk}
                    idx={idx}
                    kbId={kbId}
                    onSaved={(chunkId, title) =>
                      setChunks((prev) => prev.map((c) => (c.id === chunkId ? { ...c, title } : c)))
                    }
                  />
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

                {/* 手动向量化按钮（仅未向量化的块显示） */}
                {!chunk.qdrantId && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-primary"
                    onClick={() => handleEmbedChunk(chunk.id)}
                    disabled={embeddingChunkId === chunk.id}
                    title="手动向量化"
                  >
                    {embeddingChunkId === chunk.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <BrainCircuit className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}

                <ChunkEditDialog
                  chunk={chunk}
                  idx={idx}
                  kbId={kbId}
                  onSaved={(chunkId, newContent) => {
                    setChunks((prev) =>
                      prev.map((c) =>
                        c.id === chunkId ? { ...c, content: newContent, qdrantId: null } : c,
                      ),
                    );
                  }}
                />

                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteChunk(chunk.id)}
                  disabled={deletingChunkId === chunk.id}
                >
                  {deletingChunkId === chunk.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Danger zone ── */}
      {canDelete && (
        <div className="rounded-xl border border-destructive/30 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium">删除此知识库</p>
                <p className="text-xs text-muted-foreground">
                  操作不可撤销，所有知识块及向量数据将被永久删除。
                </p>
              </div>
            </div>
            <Dialog>
              <DialogTrigger
                render={<Button variant="destructive" size="sm" disabled={deletingKB} />}
              >
                {deletingKB ? (
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
                    此操作不可撤销。该知识库的所有知识块和向量数据将被永久删除。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
                  <Button variant="destructive" onClick={handleDeleteKB} disabled={deletingKB}>
                    {deletingKB ? (
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
