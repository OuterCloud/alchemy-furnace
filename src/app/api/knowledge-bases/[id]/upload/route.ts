import type { NextRequest } from "next/server";

import { generateChunkTitle } from "@/lib/ai/knowledge-refiner";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { embedQueue } from "@/lib/queue";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Clean a single PDF page's extracted text:
 * - Join ALL broken lines into continuous text (PDF.js emits one \n per visual line,
 *   and sometimes \n\n between text blocks on the same page — both are just layout noise)
 * - Collapse whitespace runs
 * - Remove spaces between consecutive CJK characters
 */
function cleanPageText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/(?<=[\u4e00-\u9fff\uff00-\uffef])\s+(?=[\u4e00-\u9fff\uff00-\uffef])/g, "")
    .trim();
}

/**
 * Group cleaned page texts into sections of ~2000 chars, max 20 sections.
 * Grouping by page avoids splitting mid-sentence within a page.
 */
function groupPagesIntoSections(pageTexts: string[]): string[] {
  const sections: string[] = [];
  let current = "";

  for (const page of pageTexts) {
    if (sections.length >= 20) break;
    if (current && current.length + page.length + 1 > 2000) {
      sections.push(current.trim());
      current = page;
    } else {
      current = current ? current + " " + page : page;
    }
  }

  if (current.trim() && sections.length < 20) {
    sections.push(current.trim());
  }

  return sections.filter(Boolean);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) {
    return Response.json({ error: "No workspace" }, { status: 403 });
  }

  const kb = await db.knowledgeBase.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!kb) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // pdf-parse@2.x is class-based; TextResult has per-page text in .pages[]
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require("pdf-parse") as {
    PDFParse: new (opts: { data: Uint8Array }) => {
      getText(): Promise<{ text: string; pages: Array<{ num: number; text: string }> }>;
      destroy(): Promise<void>;
    };
  };
  let pageTexts: string[];
  const parser = new PDFParse({
    data: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
  });
  try {
    const result = await parser.getText();
    // Clean each page individually, then discard empty pages
    pageTexts = result.pages.map((p) => cleanPageText(p.text)).filter(Boolean);
  } catch (err) {
    console.error("[kb/upload] pdf parse error:", err);
    return Response.json({ error: "PDF 解析失败，请确认文件未加密且内容为文本" }, { status: 422 });
  } finally {
    await parser.destroy().catch(() => undefined);
  }

  if (pageTexts.length === 0) {
    return Response.json({ error: "PDF 中未提取到文本内容" }, { status: 422 });
  }

  const sections = groupPagesIntoSections(pageTexts);
  if (sections.length === 0) {
    return Response.json({ error: "PDF 内容过短，无法提取有效段落" }, { status: 422 });
  }

  // PDF text is already complete — skip LLM expansion (saves ~92% tokens).
  // Only generate titles to help users identify chunks.
  const refined = await Promise.all(
    sections.map(async (section) => {
      const title = await generateChunkTitle(section);
      return { content: section, title };
    }),
  );

  // Batch create chunks
  const chunks = await Promise.all(
    refined.map(({ content, title }) =>
      db.knowledgeChunk.create({
        data: { knowledgeBaseId: id, content, title: title || null },
        select: { id: true, title: true, content: true, qdrantId: true, createdAt: true },
      }),
    ),
  );

  // Queue embedding for each chunk
  chunks.forEach((chunk) => {
    embedQueue
      .add("embed-chunk", { chunkId: chunk.id, knowledgeBaseId: id })
      .catch((err: unknown) => console.error("[kb/upload] embed enqueue failed:", err));
  });

  return Response.json(
    {
      count: chunks.length,
      chunks: chunks.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    },
    { status: 201 },
  );
}
