import type { NextRequest } from "next/server";

import { expandForKnowledgeBase, generateChunkTitle } from "@/lib/ai/knowledge-refiner";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { embedQueue } from "@/lib/queue";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Split extracted PDF text into sections of ~2000 chars, max 20 sections. */
function splitIntoSections(text: string): string[] {
  const paragraphs = text
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

  // pdf-parse is CommonJS — must require()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
  let pdfText: string;
  try {
    const result = await pdfParse(buffer);
    pdfText = result.text?.trim() ?? "";
  } catch {
    return Response.json({ error: "PDF 解析失败，请确认文件未加密且内容为文本" }, { status: 422 });
  }

  if (!pdfText) {
    return Response.json({ error: "PDF 中未提取到文本内容" }, { status: 422 });
  }

  const sections = splitIntoSections(pdfText);
  if (sections.length === 0) {
    return Response.json({ error: "PDF 内容过短，无法提取有效段落" }, { status: 422 });
  }

  // Refine each section in parallel (expand + title generation)
  const refined = await Promise.all(
    sections.map(async (section) => {
      const [content, title] = await Promise.all([
        expandForKnowledgeBase(section),
        generateChunkTitle(section),
      ]);
      return { content, title };
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
