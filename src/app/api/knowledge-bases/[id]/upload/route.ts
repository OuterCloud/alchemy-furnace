import type { NextRequest } from "next/server";

import { generateChunkTitle } from "@/lib/ai/knowledge-refiner";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { embedQueue } from "@/lib/queue";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Clean up raw PDF-extracted text:
 * - Normalize line endings and collapse whitespace runs
 * - Within each paragraph, join broken lines (PDF renders one line per text item)
 * - Remove spaces between CJK characters (Chinese doesn't use inter-character spaces)
 */
function cleanPdfText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split(/\n{2,}/)
    .map((para) =>
      para
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join(" ")
        // Remove spaces between CJK characters (lookbehind/lookahead preserves surrounding chars)
        .replace(/(?<=[\u4e00-\u9fff\uff00-\uffef])\s+(?=[\u4e00-\u9fff\uff00-\uffef])/g, ""),
    )
    .filter(Boolean)
    .join("\n\n");
}

/** Split cleaned PDF text into sections of ~2000 chars, max 20 sections. */
function splitIntoSections(text: string): string[] {
  const paragraphs = cleanPdfText(text)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sections: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (sections.length >= 20) break;
    if (current && current.length + para.length + 2 > 2000) {
      sections.push(current.trim());
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }

  if (current.trim() && sections.length < 20) {
    sections.push(current.trim());
  }

  return sections.filter((s) => s.length > 0);
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

  // pdf-parse@2.x is class-based — new PDFParse({ data }) instead of the v1 function API
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require("pdf-parse") as {
    PDFParse: new (opts: { data: Uint8Array }) => {
      getText(params?: { pageJoiner?: string }): Promise<{ text: string }>;
      destroy(): Promise<void>;
    };
  };
  let pdfText: string;
  const parser = new PDFParse({
    data: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
  });
  try {
    const result = await parser.getText({ pageJoiner: "\n\n" });
    pdfText = result.text?.trim() ?? "";
  } catch (err) {
    console.error("[kb/upload] pdf parse error:", err);
    return Response.json({ error: "PDF 解析失败，请确认文件未加密且内容为文本" }, { status: 422 });
  } finally {
    await parser.destroy().catch(() => undefined);
  }

  if (!pdfText) {
    return Response.json({ error: "PDF 中未提取到文本内容" }, { status: 422 });
  }

  const sections = splitIntoSections(pdfText);
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
