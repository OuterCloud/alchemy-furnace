import type { NextRequest } from "next/server";

import { DEFAULT_MODEL, llm } from "@/lib/ai/client";
import { embed } from "@/lib/ai/embedder";
import { auth } from "@/lib/auth";
import { buildParamSchema, callDataSource } from "@/lib/data-source/caller";
import { db } from "@/lib/db";
import { searchChunks } from "@/lib/vector";

// Do NOT add `export const runtime = "edge"` — embedder requires Node.js ONNX runtime

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { conversationId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { content?: string; images?: string[] };
  const content = body.content?.trim() ?? "";
  const images = Array.isArray(body.images) ? body.images : [];
  if (!content && images.length === 0) {
    return Response.json({ error: "content or images required" }, { status: 400 });
  }

  // Ownership check
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, userId: session.user.id },
    include: {
      role: {
        select: {
          systemPrompt: true,
          allowDataRequest: true,
          knowledgeBases: { select: { knowledgeBaseId: true } },
          dataSources: {
            include: { dataSource: true },
          },
        },
      },
    },
  });
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Save USER message
  await db.message.create({
    data: {
      conversationId,
      role: "USER",
      content,
      ...(images.length > 0 && { imageUrls: JSON.stringify(images) }),
    },
  });

  // RAG: only when role has knowledge bases attached and there is text to embed
  const kbIds = conversation.role.knowledgeBases.map((kb) => kb.knowledgeBaseId);
  let ragContext = "";

  if (kbIds.length > 0 && content) {
    try {
      const vector = await embed(content);
      const hits = await searchChunks({ vector, kbIds, limit: 5 });
      if (hits.length > 0) {
        const chunkIds = hits.map((h) => h.chunkId).filter(Boolean);
        const chunks = await db.knowledgeChunk.findMany({
          where: { id: { in: chunkIds } },
          select: { content: true },
        });
        ragContext = chunks.map((c) => c.content).join("\n\n---\n\n");
      }
    } catch {
      // RAG failure is non-fatal; continue without context
    }
  }

  // Fetch last 10 history messages before the USER message just saved
  const recentMsgs = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 11,
    select: { role: true, content: true },
  });
  // Drop index 0 (the USER msg we just wrote), keep up to 10, restore chronological order
  const historyWithoutLast = recentMsgs.slice(1, 11).reverse();

  const dataRequestInstruction = conversation.role.allowDataRequest
    ? "\n\n---\n当你判断需要真实数据才能给出准确分析时，不要编造数据，请明确告知用户需要提供哪些具体数据，说明每项数据的作用和格式要求，等用户提供后再给出分析结论。"
    : "";

  const systemContent =
    conversation.role.systemPrompt +
    dataRequestInstruction +
    (ragContext ? "\n\n---\n以下是相关知识库内容，请参考这些内容回答用户：\n\n" + ragContext : "");

  type TextPart = { type: "text"; text: string };
  type ImagePart = { type: "image_url"; image_url: { url: string } };

  const userContent: string | Array<TextPart | ImagePart> =
    images.length > 0
      ? [
          ...(content ? [{ type: "text" as const, text: content }] : []),
          ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
        ]
      : content;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const llmMessages: any[] = [
    { role: "system", content: systemContent },
    ...historyWithoutLast.map((m) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
    })),
    { role: "user", content: userContent },
  ];

  // Build SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let fullContent = "";

      try {
        // ── Tool calling (first pass, non-streaming) ──────────────────────────
        const roleDataSources = conversation.role.dataSources;

        if (roleDataSources.length > 0) {
          const tools = roleDataSources.map((rds) => ({
            type: "function" as const,
            function: {
              name: rds.dataSource.id,
              description: rds.dataSource.description ?? rds.dataSource.name,
              parameters: buildParamSchema(rds.dataSource.paramSchema),
            },
          }));

          const decision = await llm.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: llmMessages,
            tools,
            tool_choice: "auto",
          });

          const choice = decision.choices[0];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toolCalls = (choice?.message as any)?.tool_calls as any[] | undefined;
          if (choice?.finish_reason === "tool_calls" && toolCalls?.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolCall = toolCalls[0] as any;
            const dsId = toolCall.function?.name as string | undefined;
            const rds = roleDataSources.find((r) => r.dataSource.id === dsId);

            if (rds && dsId) {
              send({ type: "tool_call", name: rds.dataSource.name });

              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(toolCall.function.arguments as string) as Record<string, unknown>;
              } catch {
                // malformed args — use empty
              }

              let toolResult = "";
              try {
                toolResult = await callDataSource(rds.dataSource, args);
              } catch (err) {
                toolResult = `Error: ${err instanceof Error ? err.message : "Request failed"}`;
              }

              // Append tool exchange to messages
              llmMessages.push({
                role: "assistant",
                content: null,
                tool_calls: [toolCall],
              });
              llmMessages.push({
                role: "tool",
                content: toolResult,
                tool_call_id: toolCall.id as string,
              });
            }
          }
        }

        // ── Second pass: streaming response ──────────────────────────────────
        const completion = await llm.chat.completions.create({
          model: DEFAULT_MODEL,
          messages: llmMessages,
          stream: true,
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullContent += delta;
            send({ type: "delta", content: delta });
          }
        }

        // Persist ASSISTANT message
        const assistantMsg = await db.message.create({
          data: { conversationId, role: "ASSISTANT", content: fullContent },
        });

        // Update conversation timestamp
        await db.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        send({ type: "done", messageId: assistantMsg.id });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
