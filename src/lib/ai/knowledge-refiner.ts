import { DEFAULT_MODEL, llm } from "@/lib/ai/client";

/**
 * Lightweight cleanup for PDF-extracted text chunks.
 * Removes page headers/footers, fixes broken sentences, preserves all real content.
 * Does NOT expand or summarize — output length is similar to input.
 */
const CLEANUP_PDF_CHUNK_PROMPT = `你是文本清洗专家，专门处理从PDF提取的原始文本。

任务：将以下PDF原始文本整理为通顺、连贯的中文段落。

规则：
- 去除重复出现的页眉、页脚、章节编号等版面噪音（如"第X节第X节"这类重复）
- 修复因PDF换行/分页导致的断字、断句，使句子语义完整
- 删除仅凭文字无法理解的图片引用：包括"如图X所示""见下图""图X：…"等图表标题和纯引用句；若句子除图片引用外还含有实质性文字说明，保留文字部分
- 完整保留所有正文内容，不增减实质信息，不总结，不扩充
- 输出纯文本，段落间用空行分隔

原始文本：
{text}

直接输出整理后的正文，不加任何说明。`;

export async function cleanupPdfChunk(text: string): Promise<string> {
  const res = await llm.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: "user", content: CLEANUP_PDF_CHUNK_PROMPT.replace("{text}", text) }],
    temperature: 0.1,
    max_tokens: 2500,
  });
  return res.choices[0]?.message?.content?.trim() ?? text;
}

/**
 * Expand raw user input into structured knowledge base content suitable for RAG retrieval.
 * Short hints are expanded into detailed methodology; already-detailed content is preserved.
 * Non-streaming — used when adding content to a KnowledgeBase.
 */
const EXPAND_FOR_KB_PROMPT = `你是一名知识工程师，专门将原始内容整理为适合向量数据库存储和检索的知识条目。

规则：
- 输入是简短的概念或想法时：围绕核心思想合理扩充，补充具体的方法论、原则、应用场景和关键要点
- 输入是已完整的内容时：保留所有信息，适当梳理结构，去掉无关的过渡语
- 禁止编造原始输入中没有任何依据的具体数据或案例
- 输出纯文本，语言风格与原内容一致，无需标题或序号
- 长度控制：简短输入扩充至 150-400 字；已详细的输入保留原长度

用途：生成的内容将被向量化后存入知识库，在用户提问时按语义相似度召回，用于增强 AI 专家的回答。

原始输入：
<input>
{input}
</input>

背景（可选，仅供参考）：
<context>
{context}
</context>

直接输出扩充后的知识内容，纯文本。`;

/**
 * Draft a system prompt from scratch based on raw content.
 */
const DRAFT_FROM_SCRATCH_PROMPT = `你是顶级 AI Skill 架构师。将原始知识提炼为一个精准的专家 AI 身份定义（systemPrompt）。

关键约束：
- 长度：150-250字
- 目标：定义这位 AI 专家「是谁」「如何思考」「如何回答」
- 禁止：详细操作步骤和知识清单（这些内容已存入知识库，会在需要时检索）

输出结构：
1. 角色定位（2-3句）：专家身份 + 核心专长领域，足够具体、立即可辨识
2. 思维框架（1-2句）：该专家独特的分析逻辑和决策方式
3. 工作方式（1-2句）：如何处理用户问题、组织回答
4. 边界声明（1句）：超出专长范围时如何应对

原始内容：
<content>
{content}
</content>

直接输出 systemPrompt，纯文本，不加任何包裹或说明。`;

/**
 * Draft/update a system prompt given the current prompt and a new instruction.
 */
const DRAFT_WITH_INSTRUCTION_PROMPT = `你是顶级 AI Skill 架构师。根据当前 systemPrompt 和新指令，生成一个更新后的 systemPrompt。

关键约束：
- 长度：150-250字
- 目标：定义「是谁」「如何思考」「如何回答」
- 禁止：详细操作步骤和知识清单

输出结构：
1. 角色定位（2-3句）：专家身份 + 核心专长领域
2. 思维框架（1-2句）：独特的分析逻辑和决策方式
3. 工作方式（1-2句）：如何处理问题、组织回答
4. 边界声明（1句）：超出专长范围时如何应对

当前 systemPrompt：
<current>
{current}
</current>

新指令：
<instruction>
{instruction}
</instruction>

直接输出更新后的 systemPrompt，纯文本，不加任何包裹或说明。`;

/**
 * Optimize an existing knowledge chunk with an optional user instruction.
 * Used in the chunk edit dialog's "AI 优化" feature.
 */
const OPTIMIZE_CHUNK_PROMPT = `你是一名知识工程师，负责优化知识库中的知识块，使其更适合向量检索和语义召回。

优化目标：
- 语义清晰：确保核心概念表达精确，无歧义
- 结构完整：补充必要的上下文，使知识块独立可读
- 去除冗余：删除重复表述和无意义的过渡语
- 保留原意：禁止删除原内容中任何有意义的信息，禁止编造新内容

{instruction_section}

当前知识块内容：
<content>
{content}
</content>

直接输出优化后的知识块内容，纯文本，不加任何包裹或说明。`;

/**
 * Generate a concise title (≤15 chars) for a knowledge chunk based on its raw input.
 * Runs in parallel with expandForKnowledgeBase to add no extra latency.
 */
export async function generateChunkTitle(rawInput: string): Promise<string> {
  const res = await llm.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: "user",
        content: `根据以下内容，生成一个简洁的知识块标题（最多15字，无标点符号，直接输出标题）：\n\n${rawInput.slice(0, 500)}`,
      },
    ],
    max_tokens: 30,
    temperature: 0.3,
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

export async function optimizeChunk(content: string, instruction?: string): Promise<string> {
  const instructionSection = instruction?.trim()
    ? `用户优化指令（优先遵循）：\n${instruction.trim()}`
    : `（无额外指令，按通用优化目标执行）`;
  const prompt = OPTIMIZE_CHUNK_PROMPT.replace("{instruction_section}", instructionSection).replace(
    "{content}",
    content,
  );
  const res = await llm.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 1500,
  });
  return res.choices[0]?.message?.content?.trim() ?? content;
}

export async function expandForKnowledgeBase(rawInput: string, context?: string): Promise<string> {
  const prompt = EXPAND_FOR_KB_PROMPT.replace("{input}", rawInput).replace(
    "{context}",
    context ?? "（暂无）",
  );
  const res = await llm.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5,
    max_tokens: 1200,
  });
  return res.choices[0]?.message?.content?.trim() ?? rawInput;
}

export function streamDraftFromScratch(content: string) {
  return llm.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: "user",
        content: DRAFT_FROM_SCRATCH_PROMPT.replace("{content}", content),
      },
    ],
    stream: true,
  });
}

export function streamDraftPrompt(currentPrompt: string, instruction: string) {
  return llm.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: "user",
        content: DRAFT_WITH_INSTRUCTION_PROMPT.replace("{current}", currentPrompt).replace(
          "{instruction}",
          instruction,
        ),
      },
    ],
    stream: true,
  });
}
