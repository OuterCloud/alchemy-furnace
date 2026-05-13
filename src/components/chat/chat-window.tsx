"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, History, MessageSquarePlus, Pencil, Trash2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  imageUrls: string[] | null;
  createdAt: string;
}

interface RoleConversation {
  id: string;
  title: string | null;
  updatedAt: string;
  firstUserMessage: string | null;
}

interface ChatWindowProps {
  conversationId: string;
  roleId: string;
  role: { name: string };
  initialMessages: ChatMessage[];
  roleConversations: RoleConversation[];
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => (
          <h1 className="mt-3 mb-2 text-base font-bold first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-3 mb-2 text-sm font-bold first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-2 mb-1 text-sm font-semibold first:mt-0">{children}</h3>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children, className }) => {
          const isBlock = className?.startsWith("language-");
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded bg-black/20 px-3 py-2 font-mono text-xs">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-black/20 px-1 py-0.5 font-mono text-xs">{children}</code>
          );
        },
        pre: ({ children }) => <pre className="mt-1 mb-2 last:mb-0">{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-current pl-3 opacity-70 last:mb-0">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-2 border-current opacity-20" />,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function convLabel(conv: RoleConversation): string {
  return conv.title ?? conv.firstUserMessage ?? "空对话";
}

function ConversationItem({
  conv,
  isCurrent,
  onRename,
  onDelete,
}: {
  conv: RoleConversation;
  isCurrent: boolean;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(convLabel(conv));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitRename = async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === convLabel(conv)) {
      setEditValue(convLabel(conv));
      setEditing(false);
      return;
    }
    setSaving(true);
    await onRename(conv.id, trimmed);
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(conv.id);
    // onDelete handles redirect/removal; if it fails it will setDeleting(false) via toast
  };

  if (editing) {
    return (
      <div className="rounded-lg bg-muted px-3 py-2">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setEditValue(convLabel(conv));
              setEditing(false);
            }
          }}
          onBlur={commitRename}
          disabled={saving}
          className="w-full bg-transparent text-sm outline-none"
          autoFocus
        />
        <p className="mt-0.5 text-xs text-muted-foreground">Enter 确认，Esc 取消</p>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60 ${
        isCurrent ? "bg-muted font-medium" : ""
      }`}
    >
      {/* Clickable area to navigate */}
      <Link href={`/conversations/${conv.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm">{convLabel(conv)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true, locale: zhCN })}
        </p>
      </Link>

      {/* Action buttons — visible on hover */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => {
            setEditValue(convLabel(conv));
            setEditing(true);
          }}
          className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
          title="重命名"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="cursor-pointer rounded p-1 text-muted-foreground hover:text-destructive disabled:cursor-not-allowed"
          title="删除对话"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ChatWindow({
  conversationId,
  roleId,
  role,
  initialMessages,
  roleConversations: initialRoleConversations,
}: ChatWindowProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [startingNew, setStartingNew] = useState(false);
  const [convList, setConvList] = useState<RoleConversation[]>(initialRoleConversations);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  useEffect(() => {
    if (!lightboxImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxImage(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxImage]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if ((!content && pendingImages.length === 0) || isStreaming) return;

    const imagesToSend = [...pendingImages];
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "USER",
        content,
        imageUrls: imagesToSend.length > 0 ? imagesToSend : null,
        createdAt: new Date().toISOString(),
      },
    ]);
    setInput("");
    setPendingImages([]);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          ...(imagesToSend.length > 0 && { images: imagesToSend }),
        }),
      });

      if (!res.ok || !res.body) throw new Error("发送失败");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data) as
              | { type: "delta"; content: string }
              | { type: "done"; messageId: string };

            if (parsed.type === "delta") {
              accumulated += parsed.content;
              setStreamingContent(accumulated);
            } else if (parsed.type === "done") {
              setMessages((prev) => [
                ...prev,
                {
                  id: parsed.messageId,
                  role: "ASSISTANT",
                  content: accumulated,
                  imageUrls: null,
                  createdAt: new Date().toISOString(),
                },
              ]);
              // Update firstUserMessage for current conv in list if it was empty
              setConvList((prev) =>
                prev.map((c) =>
                  c.id === conversationId && !c.firstUserMessage
                    ? { ...c, firstUserMessage: content }
                    : c,
                ),
              );
              setStreamingContent("");
              setIsStreaming(false);
            }
          } catch {
            // skip malformed SSE line
          }
        }
      }
    } catch {
      toast.error("发送失败，请重试");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setPendingImages(imagesToSend);
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [input, pendingImages, isStreaming, conversationId]);

  const handleNewConversation = async () => {
    if (startingNew) return;
    setStartingNew(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      if (!res.ok) throw new Error();
      const { id } = (await res.json()) as { id: string };
      router.push(`/conversations/${id}`);
    } catch {
      toast.error("创建失败，请重试");
      setStartingNew(false);
    }
  };

  const handleRename = async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error();
      setConvList((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    } catch {
      toast.error("重命名失败，请重试");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setConvList((prev) => prev.filter((c) => c.id !== id));
      // If deleting the current conversation, navigate away
      if (id === conversationId) {
        const remaining = convList.filter((c) => c.id !== id);
        router.push(remaining[0] ? `/conversations/${remaining[0].id}` : "/conversations");
      }
    } catch {
      toast.error("删除失败，请重试");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItems = Array.from(e.clipboardData.items).filter((item) =>
      item.type.startsWith("image/"),
    );
    if (imageItems.length === 0) return;
    e.preventDefault();
    imageItems.forEach((item) => {
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result;
        if (typeof dataUrl === "string") setPendingImages((prev) => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImage}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<Link href="/conversations" />}
        >
          <ChevronLeft />
          <span className="sr-only">返回</span>
        </Button>
        <span className="flex-1 font-medium">{role.name}</span>

        {/* History sheet trigger */}
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon-sm" title="历史对话">
                <History />
                <span className="sr-only">历史对话</span>
              </Button>
            }
          />
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>与「{role.name}」的历史对话</SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-1 overflow-y-auto px-4 pb-4">
              {/* New conversation button */}
              <button
                onClick={handleNewConversation}
                disabled={startingNew}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageSquarePlus className="h-4 w-4 shrink-0" />
                {startingNew ? "创建中..." : "新建对话"}
              </button>

              {convList.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">暂无历史对话</p>
              ) : (
                convList.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isCurrent={conv.id === conversationId}
                    onRename={handleRename}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && !isStreaming && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              发送第一条消息，开始与 {role.name} 对话
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "USER"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.role === "USER" ? (
                  <>
                    {msg.imageUrls && msg.imageUrls.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {msg.imageUrls.map((url, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={url}
                            alt=""
                            onClick={() => setLightboxImage(url)}
                            className="max-h-48 max-w-full cursor-zoom-in rounded-lg object-contain"
                          />
                        ))}
                      </div>
                    )}
                    {msg.content && (
                      <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </>
                ) : (
                  <MarkdownContent content={msg.content} />
                )}
              </div>
            </div>
          ))}

          {/* Streaming assistant bubble */}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[75%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground">
                {streamingContent ? (
                  <MarkdownContent content={streamingContent} />
                ) : (
                  <span className="animate-pulse text-muted-foreground">···</span>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        {/* Pending image thumbnails */}
        {pendingImages.length > 0 && (
          <div className="mx-auto mb-2 flex max-w-2xl flex-wrap gap-2">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt=""
                  onClick={() => setLightboxImage(img)}
                  className="h-16 w-16 cursor-zoom-in rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-foreground text-background"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="输入消息… (Enter 发送，Shift+Enter 换行，可直接粘贴截图)"
            className="max-h-40 min-h-10 resize-none"
            disabled={isStreaming}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={isStreaming || (!input.trim() && pendingImages.length === 0)}
            className="shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
            <span className="sr-only">发送</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
