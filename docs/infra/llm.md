# LLM 客户端（OpenAI SDK，兼容任意 OpenAI 协议接口）

## 它是什么

项目使用 **OpenAI SDK** (`openai` npm 包）调用大语言模型。通过三个环境变量配置接入地址和模型，可以连接任何 **OpenAI 协议兼容的服务**——包括 OpenAI 官方、Azure OpenAI、Groq、Together AI，以及通过 Ollama / LiteLLM 自托管的开源模型。

**一句话理解：** 代码只认 OpenAI 协议，换供应商只需改环境变量，代码零改动。

---

## 环境变量

```env
LLM_BASE_URL=https://api.openai.com/v1   # 兼容 OpenAI 协议的服务地址
LLM_API_KEY=sk-xxxx                       # 对应服务的 API Key
LLM_MODEL=gpt-4o                          # 默认使用的模型（缺省值 gpt-4o）
```

⚠️ 这三个变量都是**服务端变量**，永远不会暴露给浏览器。

### 常见接入方式

| 服务 | LLM_BASE_URL | 说明 |
|------|-------------|------|
| OpenAI | `https://api.openai.com/v1` | 官方接口 |
| Azure OpenAI | `https://{resource}.openai.azure.com/openai/deployments/{deploy}` | 需 Azure 账号 |
| Groq | `https://api.groq.com/openai/v1` | 高速推理，有免费额度 |
| Together AI | `https://api.together.xyz/v1` | 多种开源模型 |
| Ollama（本地）| `http://localhost:11434/v1` | 完全离线，需本地跑模型 |
| LiteLLM Proxy | `http://localhost:4000` | 统一代理多个供应商 |

---

## 代码中怎么用

单例定义在 `src/lib/ai/client.ts`：

```ts
import { llm, DEFAULT_MODEL } from "@/lib/ai/client";

// llm 是 OpenAI 实例，可以直接调所有 OpenAI SDK 的方法
// DEFAULT_MODEL 是 env.LLM_MODEL，当前配置的模型名称
```

**不要** 在业务代码中直接 `new OpenAI()`，统一用这个单例。

---

## 三种调用模式

### 1. 普通非流式调用（适合后台任务）

```ts
const resp = await llm.chat.completions.create({
  model: DEFAULT_MODEL,
  messages: [
    { role: "system", content: "你是专家..." },
    { role: "user", content: "问题内容" },
  ],
});
const text = resp.choices[0]?.message.content ?? "";
```

用于：知识炼化（`knowledge-refiner.ts`）、第一次工具调用决策（数据源 function calling）等不需要实时输出的场景。

### 2. 流式调用（对话 SSE）

```ts
const completion = await llm.chat.completions.create({
  model: DEFAULT_MODEL,
  messages: llmMessages,
  stream: true,
});

for await (const chunk of completion) {
  const delta = chunk.choices[0]?.delta.content;
  if (delta) {
    // 逐 token 发送给前端
    controller.enqueue(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
  }
}
```

用于：对话消息接口（`/api/conversations/[id]/messages`），让用户看到实时打字效果。

### 3. Function Calling（数据源工具调用）

```ts
// 第一次调用：非流式，让 LLM 决定是否调用工具
const decision = await llm.chat.completions.create({
  model: DEFAULT_MODEL,
  messages: llmMessages,
  tools: [...],          // 数据源列表转成 OpenAI tools 格式
  tool_choice: "auto",   // LLM 自主决定要不要调
});

if (decision.choices[0]?.finish_reason === "tool_calls") {
  // LLM 决定调工具，执行 HTTP 请求，把结果追加到 messages
}

// 第二次调用：流式，生成最终回复
const stream = await llm.chat.completions.create({
  model: DEFAULT_MODEL,
  messages: llmMessages,  // 已包含工具执行结果
  stream: true,
});
```

---

## 多模态（图片 + 文字）

模型支持 vision 时（如 gpt-4o），消息可以混合文字和图片：

```ts
{
  role: "user",
  content: [
    { type: "text", text: "这张图里有什么问题？" },
    {
      type: "image_url",
      image_url: { url: "data:image/png;base64,iVBORw0KGgo..." },
    },
  ],
}
```

项目中图片通过 Cmd+V 粘贴，转为 base64 data URL 直接发给 LLM，无需上传到外部存储。

---

## 知识炼化用到的能力

`src/lib/ai/knowledge-refiner.ts` 使用两种提示词：

| 函数 | 用途 |
|------|------|
| `expandForKnowledgeBase(input, context)` | 把简短原料扩充为 150-400 字的知识条目，适合向量化存储 |
| `draftSystemPromptFromScratch(content)` | 从原始内容生成 150-250 字的 system prompt（角色定位） |
| `refineSystemPrompt(existing, newContent)` | 在已有 system prompt 基础上融合新内容 |

这些都是普通非流式调用，结果直接写入数据库。

---

## API Route 中使用注意

对话消息接口 `/api/conversations/[id]/messages` 使用 **Node.js runtime**（非 Edge Runtime），因为流式 SSE 需要 `ReadableStream` + `TransformStream` 的完整实现：

```ts
// 文件顶部
export const runtime = "nodejs";
```

Edge Runtime 下某些 Node.js 流 API 不可用，会报错。

---

## 常见问题

**Q：调用报错 `401 Unauthorized`**
→ 检查 `LLM_API_KEY` 是否正确。

**Q：调用报错 `404 Not Found`**
→ 检查 `LLM_BASE_URL` 是否以 `/v1` 结尾，且对应服务正在运行。

**Q：想换一个模型或供应商**
→ 修改 `.env` 中的 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`，重启 `pnpm dev` 生效。确认新模型是否支持 function calling / vision 再使用对应功能。

**Q：流式输出没有响应**
→ 确认 API Route 文件顶部有 `export const runtime = "nodejs"`。

**Q：使用 Ollama 本地模型时 function calling 不工作**
→ 并非所有 Ollama 模型都支持 function calling，需使用 `llama3.1`、`mistral-nemo` 等明确支持工具调用的模型。
