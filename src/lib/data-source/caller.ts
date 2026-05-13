import type OpenAI from "openai";

interface ParamDef {
  name: string;
  type: "string" | "number" | "boolean";
  description?: string;
  required?: boolean;
}

export function buildParamSchema(paramSchema: unknown): OpenAI.FunctionParameters {
  const params = Array.isArray(paramSchema) ? (paramSchema as ParamDef[]) : [];

  const properties: Record<string, { type: string; description?: string }> = {};
  const required: string[] = [];

  for (const p of params) {
    if (!p.name) continue;
    properties[p.name] = { type: p.type ?? "string" };
    if (p.description) properties[p.name]!.description = p.description;
    if (p.required) required.push(p.name);
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 && { required }),
  };
}

export async function callDataSource(
  ds: {
    method: string;
    url: string;
    headers: unknown;
    paramSchema: unknown;
  },
  args: Record<string, unknown>,
): Promise<string> {
  const method = ds.method.toUpperCase();
  const headersMap: Record<string, string> = {};

  if (ds.headers && typeof ds.headers === "object" && !Array.isArray(ds.headers)) {
    for (const [k, v] of Object.entries(ds.headers as Record<string, unknown>)) {
      if (typeof v === "string") headersMap[k] = v;
    }
  }

  let url = ds.url;
  let body: string | undefined;

  if (method === "GET" || method === "DELETE") {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(args)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const qsStr = qs.toString();
    if (qsStr) url = `${url}${url.includes("?") ? "&" : "?"}${qsStr}`;
  } else {
    headersMap["Content-Type"] = "application/json";
    body = JSON.stringify(args);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method,
      headers: headersMap,
      ...(body !== undefined && { body }),
      signal: controller.signal,
    });

    const text = await res.text();
    const MAX_CHARS = 8000;
    return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n...[截断]" : text;
  } finally {
    clearTimeout(timeout);
  }
}
