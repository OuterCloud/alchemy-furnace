"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Send,
  Terminal,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ParamDef {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

interface DataSource {
  id: string;
  name: string;
  description: string | null;
  method: string;
  url: string;
  headers: Record<string, string> | null;
  paramSchema: ParamDef[] | null;
}

interface SourceEditorProps {
  initialData?: DataSource;
}

// ── cURL parser ───────────────────────────────────────────────────────────────

interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

/** Shell-style tokenizer: handles single/double quotes and line continuations. */
function tokenizeCurl(input: string): string[] {
  // Normalize Windows line endings and line continuations
  const src = input
    .replace(/\r\n/g, "\n")
    .replace(/\\\n\s*/g, " ")
    .trim();
  const tokens: string[] = [];
  let i = 0;

  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i]!)) i++;
    if (i >= src.length) break;

    if (src[i] === "'") {
      // Single-quoted: no escape processing
      i++;
      let tok = "";
      while (i < src.length && src[i] !== "'") tok += src[i++];
      if (src[i] === "'") i++;
      tokens.push(tok);
    } else if (src[i] === '"') {
      // Double-quoted: handle \" and \\
      i++;
      let tok = "";
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < src.length) {
          i++;
          tok += src[i++];
        } else {
          tok += src[i++];
        }
      }
      if (src[i] === '"') i++;
      tokens.push(tok);
    } else {
      // Unquoted
      let tok = "";
      while (i < src.length && !/\s/.test(src[i]!)) tok += src[i++];
      tokens.push(tok);
    }
  }
  return tokens;
}

/** Parse a cURL command into its constituent parts. */
function parseCurl(input: string): ParsedCurl {
  const tokens = tokenizeCurl(input);
  if (!tokens[0]?.match(/^curl$/i)) throw new Error("不是有效的 curl 命令，请以 curl 开头");

  let method = "";
  let url = "";
  const headers: Record<string, string> = {};
  let body: string | null = null;

  // Flags that consume the next token as their value
  const VALUE_FLAGS = new Set([
    "-X",
    "--request",
    "-H",
    "--header",
    "-d",
    "--data",
    "--data-raw",
    "--data-binary",
    "--data-urlencode",
    "-u",
    "--user",
    "--oauth2-bearer",
    "-o",
    "--output",
    "-e",
    "--referer",
    "--max-time",
    "-m",
    "--connect-timeout",
    "--retry",
    "-A",
    "--user-agent",
    "--proxy",
    "-x",
    "--cert",
    "--key",
    "--cacert",
  ]);
  // Flags that are pure boolean (consume no value)
  const BOOL_FLAGS = new Set([
    "--compressed",
    "-L",
    "--location",
    "-s",
    "--silent",
    "-v",
    "--verbose",
    "-k",
    "--insecure",
    "-I",
    "--head",
    "-f",
    "--fail",
    "-g",
    "--globoff",
    "-G",
    "--get",
    "--http1.0",
    "--http1.1",
    "--http2",
    "--http3",
    "--no-keepalive",
    "--keepalive-time",
  ]);

  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i]!;

    if (tok === "-X" || tok === "--request") {
      method = (tokens[++i] ?? "").toUpperCase();
    } else if (tok === "-H" || tok === "--header") {
      const raw = tokens[++i] ?? "";
      const colon = raw.indexOf(":");
      if (colon > 0) {
        headers[raw.slice(0, colon).trim()] = raw.slice(colon + 1).trim();
      }
    } else if (
      tok === "-d" ||
      tok === "--data" ||
      tok === "--data-raw" ||
      tok === "--data-binary" ||
      tok === "--data-urlencode"
    ) {
      body = tokens[++i] ?? null;
      if (!method) method = "POST"; // infer POST when body is present
    } else if (tok === "-u" || tok === "--user") {
      const userpass = tokens[++i] ?? "";
      headers["Authorization"] = `Basic ${btoa(userpass)}`;
    } else if (tok === "--oauth2-bearer") {
      headers["Authorization"] = `Bearer ${tokens[++i] ?? ""}`;
    } else if (BOOL_FLAGS.has(tok)) {
      // no-op
    } else if (VALUE_FLAGS.has(tok)) {
      i++; // skip value of unknown flag
    } else if (tok.startsWith("-")) {
      // Combined short flag (e.g. -sS) or unknown flag — skip
    } else if (!url) {
      url = tok;
    }

    i++;
  }

  if (!url) throw new Error("未能从命令中识别出 URL");
  if (!method) method = "GET";

  return { method, url, headers, body };
}

/** Sanitize a key to a valid param name (/^[a-z][a-z0-9_]*$/). */
function sanitizeParamName(key: string): string {
  const cleaned = key
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^[^a-zA-Z]+/, "")
    .toLowerCase();
  return cleaned || "param";
}

/** Infer param definitions from a request body or query string. */
function inferParams(parsed: ParsedCurl): ParamDef[] {
  const contentType = parsed.headers["Content-Type"] ?? parsed.headers["content-type"] ?? "";

  // Try JSON body
  if (parsed.body) {
    try {
      const json = JSON.parse(parsed.body) as unknown;
      if (json && typeof json === "object" && !Array.isArray(json)) {
        return Object.entries(json as Record<string, unknown>).map(([key, value]) => ({
          name: sanitizeParamName(key),
          type:
            typeof value === "number"
              ? ("number" as const)
              : typeof value === "boolean"
                ? ("boolean" as const)
                : ("string" as const),
          description: "",
          required: false,
        }));
      }
    } catch {
      // not JSON
    }

    // Try form-encoded body
    if (contentType.includes("application/x-www-form-urlencoded")) {
      try {
        return Array.from(new URLSearchParams(parsed.body).keys()).map((key) => ({
          name: sanitizeParamName(key),
          type: "string" as const,
          description: "",
          required: false,
        }));
      } catch {
        // ignore
      }
    }
  }

  // Fall back to query string params in the URL (useful for GET)
  try {
    const qIndex = parsed.url.indexOf("?");
    if (qIndex !== -1) {
      const qs = parsed.url.slice(qIndex + 1);
      const keys = Array.from(new URLSearchParams(qs).keys());
      if (keys.length > 0) {
        return keys.map((key) => ({
          name: sanitizeParamName(key),
          type: "string" as const,
          description: "",
          required: false,
        }));
      }
    }
  } catch {
    // ignore
  }

  return [];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const PARAM_TYPES = ["string", "number", "boolean"] as const;
const PARAM_NAME_REGEX = /^[a-z][a-z0-9_]*$/;

export function SourceEditor({ initialData }: SourceEditorProps) {
  const router = useRouter();
  const isNew = !initialData;

  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [method, setMethod] = useState(initialData?.method ?? "GET");
  const [url, setUrl] = useState(initialData?.url ?? "");
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>(
    initialData?.headers
      ? Object.entries(initialData.headers).map(([key, value]) => ({ key, value }))
      : [],
  );
  const [params, setParams] = useState<ParamDef[]>(initialData?.paramSchema ?? []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // cURL import panel
  const [curlOpen, setCurlOpen] = useState(false);
  const [curlInput, setCurlInput] = useState("");

  // Debug panel
  const [testArgs, setTestArgs] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // ── Headers ──────────────────────────────────────────────────────────────

  const addHeader = () => setHeaders((prev) => [...prev, { key: "", value: "" }]);
  const removeHeader = (i: number) => setHeaders((prev) => prev.filter((_, j) => j !== i));
  const updateHeader = (i: number, field: "key" | "value", val: string) =>
    setHeaders((prev) => prev.map((h, j) => (j === i ? { ...h, [field]: val } : h)));

  // ── Params ────────────────────────────────────────────────────────────────

  const addParam = () =>
    setParams((prev) => [...prev, { name: "", type: "string", description: "", required: false }]);
  const removeParam = (i: number) => setParams((prev) => prev.filter((_, j) => j !== i));
  const updateParam = (i: number, field: keyof ParamDef, val: unknown) =>
    setParams((prev) => prev.map((p, j) => (j === i ? { ...p, [field]: val } : p)));

  // ── cURL import ───────────────────────────────────────────────────────────

  const handleImportCurl = () => {
    try {
      const parsed = parseCurl(curlInput);

      setMethod(parsed.method);

      // Strip query string from URL when params are inferred from it
      const qIndex = parsed.url.indexOf("?");
      const hasQsParams = qIndex !== -1 && !parsed.body;
      setUrl(hasQsParams ? parsed.url.slice(0, qIndex) : parsed.url);

      setHeaders(Object.entries(parsed.headers).map(([key, value]) => ({ key, value })));

      const inferred = inferParams(parsed);
      if (inferred.length > 0) setParams(inferred);

      setCurlOpen(false);
      setCurlInput("");

      const parts = [`方法: ${parsed.method}`, `URL 已填充`];
      if (Object.keys(parsed.headers).length > 0)
        parts.push(`${Object.keys(parsed.headers).length} 个 Header`);
      if (inferred.length > 0) parts.push(`${inferred.length} 个参数已推断`);
      toast.success(parts.join("，"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "解析失败，请检查命令格式");
    }
  };

  // ── Validate ──────────────────────────────────────────────────────────────

  const validate = () => {
    if (!name.trim()) {
      toast.error("名称不能为空");
      return false;
    }
    if (!url.trim()) {
      toast.error("URL 不能为空");
      return false;
    }
    for (const p of params) {
      if (!PARAM_NAME_REGEX.test(p.name)) {
        toast.error(`参数名「${p.name}」格式不合法，需符合 /^[a-z][a-z0-9_]*$/`);
        return false;
      }
    }
    return true;
  };

  const buildPayload = () => ({
    name: name.trim(),
    description: description.trim() || null,
    method,
    url: url.trim(),
    headers:
      headers.length > 0
        ? Object.fromEntries(headers.filter((h) => h.key.trim()).map((h) => [h.key, h.value]))
        : null,
    paramSchema: params,
  });

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch(
        isNew ? "/api/data-sources" : `/api/data-sources/${initialData!.id}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        },
      );
      if (!res.ok) throw new Error("保存失败");
      if (isNew) {
        const ds = (await res.json()) as { id: string };
        toast.success("数据源已创建");
        router.push(`/sources/${ds.id}`);
      } else {
        toast.success("已保存");
        router.refresh();
      }
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!initialData) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/data-sources/${initialData.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      toast.success("数据源已删除");
      router.push("/sources");
    } catch {
      toast.error("删除失败，请重试");
      setDeleting(false);
    }
  };

  // ── Test ──────────────────────────────────────────────────────────────────

  const handleTest = async () => {
    if (!initialData) return;
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const args: Record<string, unknown> = {};
      for (const p of params) {
        const raw = testArgs[p.name] ?? "";
        if (raw === "") continue;
        if (p.type === "number") args[p.name] = Number(raw);
        else if (p.type === "boolean") args[p.name] = raw === "true";
        else args[p.name] = raw;
      }
      const res = await fetch(`/api/data-sources/${initialData.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args }),
      });
      const data = (await res.json()) as { result?: string; error?: string };
      if (data.error) {
        setTestError(data.error);
      } else {
        setTestResult(data.result ?? "");
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setTesting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ── cURL import ── */}
      <section className="rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setCurlOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">从 cURL 导入</span>
            <span className="text-xs text-muted-foreground">粘贴 curl 命令自动填充字段</span>
          </div>
          {curlOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {curlOpen && (
          <div className="flex flex-col gap-3 border-t border-border px-4 pt-3 pb-4">
            <Textarea
              value={curlInput}
              onChange={(e) => setCurlInput(e.target.value)}
              placeholder={`curl 'https://api.example.com/data' \\\n  -X POST \\\n  -H 'Authorization: Bearer token' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"query":"hello"}'`}
              className="min-h-28 font-mono text-xs"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button onClick={handleImportCurl} disabled={!curlInput.trim()} size="sm">
                解析并填充
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurlOpen(false);
                  setCurlInput("");
                }}
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ── Basic info ── */}
      <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold text-muted-foreground">基本信息</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds-name">名称</Label>
          <Input
            id="ds-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="数据源名称"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds-desc">描述</Label>
          <Textarea
            id="ds-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="此数据源返回什么数据？LLM 会通过描述来决定是否调用它。"
            className="min-h-20"
          />
        </div>
      </section>

      {/* ── API config ── */}
      <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold text-muted-foreground">接口配置</h2>
        <div className="flex gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>方法</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="ds-url">URL</Label>
            <Input
              id="ds-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/data"
              className="font-mono text-sm"
            />
          </div>
        </div>

        {/* Headers */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>请求头（Headers）</Label>
            <Button variant="ghost" size="sm" onClick={addHeader}>
              <Plus className="h-3.5 w-3.5" />
              添加
            </Button>
          </div>
          {headers.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无自定义请求头</p>
          ) : (
            headers.map((h, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={h.key}
                  onChange={(e) => updateHeader(i, "key", e.target.value)}
                  placeholder="Header 名"
                  className="w-40 font-mono text-xs"
                />
                <Input
                  value={h.value}
                  onChange={(e) => updateHeader(i, "value", e.target.value)}
                  placeholder="值"
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeHeader(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Param schema ── */}
      <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">参数定义</h2>
          <Button variant="ghost" size="sm" onClick={addParam}>
            <Plus className="h-3.5 w-3.5" />
            添加参数
          </Button>
        </div>
        {params.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            暂无参数。如果接口需要动态参数（如查询条件），请在此定义，LLM 会自动填充。
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {params.map((p, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">参数名</Label>
                      <Input
                        value={p.name}
                        onChange={(e) => updateParam(i, "name", e.target.value)}
                        placeholder="param_name"
                        className="w-36 font-mono text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">类型</Label>
                      <Select
                        value={p.type}
                        onValueChange={(v) => v && updateParam(i, "type", v as ParamDef["type"])}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PARAM_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <Label className="text-xs">描述</Label>
                      <Input
                        value={p.description}
                        onChange={(e) => updateParam(i, "description", e.target.value)}
                        placeholder="LLM 如何理解此参数"
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="mt-4 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeParam(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={p.required}
                    onChange={(e) => updateParam(i, "required", e.target.checked)}
                    className="cursor-pointer"
                  />
                  必填
                </label>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Save button ── */}
      <Button onClick={handleSave} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="animate-spin" />
            保存中…
          </>
        ) : isNew ? (
          "创建数据源"
        ) : (
          "保存更改"
        )}
      </Button>

      {/* ── Debug panel (edit mode only) ── */}
      {!isNew && (
        <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">调试面板</h2>
          {params.length > 0 && (
            <div className="flex flex-col gap-2">
              {params.map((p) => (
                <div key={p.name} className="flex flex-col gap-1">
                  <Label className="text-xs">
                    {p.name}
                    {p.required && <span className="ml-1 text-destructive">*</span>}
                    <span className="ml-1 text-muted-foreground">({p.type})</span>
                  </Label>
                  <Input
                    value={testArgs[p.name] ?? ""}
                    onChange={(e) => setTestArgs((prev) => ({ ...prev, [p.name]: e.target.value }))}
                    placeholder={p.description || p.name}
                    className="font-mono text-sm"
                  />
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="animate-spin" />
                请求中…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                发送请求
              </>
            )}
          </Button>
          {testResult !== null && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">响应结果</p>
              <pre className="overflow-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
                {testResult || "(空响应)"}
              </pre>
            </div>
          )}
          {testError !== null && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-destructive">错误</p>
              <pre className="overflow-auto rounded-lg bg-destructive/10 p-3 font-mono text-xs whitespace-pre-wrap text-destructive">
                {testError}
              </pre>
            </div>
          )}
        </section>
      )}

      {/* ── Danger zone (edit mode only) ── */}
      {!isNew && (
        <div className="rounded-xl border border-destructive/30 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium">删除此数据源</p>
                <p className="text-xs text-muted-foreground">
                  操作不可撤销，同时解除与所有角色的绑定。
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
                    此操作不可撤销。该数据源将被永久删除，与角色的绑定关系也会一并清除。
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
