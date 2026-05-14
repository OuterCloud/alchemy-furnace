# Embedder（本地向量化）

## 它是什么

Embedder 负责把一段文字转换成一个「向量」——一个 512 个小数组成的数组，代表这段文字的**语义含义**。语义相近的文字，向量之间的距离也更近，这是 RAG 检索的数学基础。

本项目使用的模型是 **`bge-small-zh-v1.5`**（由北京智源研究院发布，在 HuggingFace 上的路径是 `Xenova/bge-small-zh-v1.5`），通过 `@huggingface/transformers` 库在**本地 CPU** 上运行，无需调用任何外部 API，完全离线。

**一句话理解：** 把文字翻译成机器能比较距离的数字，用来做语义搜索。

---

## 代码位置

`src/lib/ai/embedder.ts`

```ts
import { embed, EMBED_DIM } from "@/lib/ai/embedder";

// EMBED_DIM = 512
// embed(text) 返回一个长度为 512 的 number[] 数组
const vector = await embed("用户的问题或知识内容");
```

---

## 模型细节

| 属性 | 值 |
|------|-----|
| 模型名 | `bge-small-zh-v1.5` |
| HuggingFace ID | `Xenova/bge-small-zh-v1.5` |
| 向量维度 | 512 |
| 精度 | fp32 |
| Pooling 策略 | Mean pooling + L2 归一化 |
| 模型大小 | ~24MB（首次运行自动下载） |
| 运行环境 | 本地 CPU（通过 ONNX Runtime） |
| 语言优化 | 中文（也支持英文） |

---

## 首次运行

第一次调用 `embed()` 时，`@huggingface/transformers` 会自动从 HuggingFace 下载模型文件（约 24MB），缓存在本地，之后无需重新下载。

需要确保首次运行时能联网。如果网络不通，会报错找不到模型文件：

```
Error: Could not load model ...
```

→ 解决方案：检查网络连接，或配置 HuggingFace 镜像（见下方常见问题）。

---

## 重要限制：只能在 Worker 进程中运行

`embed()` **不能在 Next.js 主进程（`pnpm dev`）中调用**。

原因：`@huggingface/transformers` 依赖 `onnxruntime-node`，这是一个 native Node.js 模块，需要完整的 Node.js 环境，而 Next.js 的某些构建模式（特别是 Edge Runtime）不支持 native 模块。

**正确做法**：所有向量化操作通过 **BullMQ 队列** 异步处理：

```
API Route → 推入 embed 队列 → Worker 进程执行 embed() → 写入 Qdrant
```

Worker 进程入口：`workers/index.ts`
向量化逻辑：`workers/embed.worker.ts`

启动 Worker：

```bash
pnpm worker
```

---

## 数据流

```
KnowledgeChunk.content（MySQL 中的文本）
    ↓
embed(content)
    ↓
[0.023, -0.117, 0.891, ...]   ← 512 个 float32 数字
    ↓
upsertChunk(qdrantId, vector, kbId, chunkId)
    ↓
Qdrant 存储（skill_knowledge 集合）
```

---

## Qdrant 里的向量长什么样

存入 Qdrant 后，一条记录（Point）的样子：

```json
{
  "id": "cma1b2c3d...",
  "vector": [0.023, -0.117, 0.891, -0.045, ...],  // 512 个数字
  "payload": {
    "kbId": "cmx9y8z7...",
    "chunkId": "cma1b2c3d..."
  }
}
```

搜索时，把用户的问题也 embed 成向量，然后找余弦相似度最高的 5 条，召回对应的知识文本。

---

## 常见问题

**Q：Worker 启动报错找不到 ONNX 模型**
→ 第一次运行会自动下载，需要联网。耐心等待下载完成（~24MB）。

**Q：HuggingFace 下载很慢或失败**
→ 可以设置镜像：

```bash
# 在 .env 中或启动命令前
HF_ENDPOINT=https://hf-mirror.com pnpm worker
```

**Q：能不能在 Next.js 里直接调 `embed()`？**
→ 不推荐。即使能跑通，embed 是 CPU 密集操作，会阻塞主进程，导致所有请求卡顿。应该通过队列异步处理。

**Q：为什么选 512 维而不是更高维？**
→ `bge-small-zh-v1.5` 本身输出就是 512 维。维度越高搜索越慢，512 在精度和性能间平衡良好，适合中文语义搜索。

**Q：知识块一直显示「待向量化」**
→ Worker 进程没有运行。执行 `pnpm worker`。
