# Redis 7 + BullMQ

## 它们是什么

**Redis** 是内存数据库，在本项目中只用作消息队列的存储后端（不做缓存）。

**BullMQ** 是构建在 Redis 之上的 Node.js 任务队列库，负责管理需要异步处理的耗时任务（向量化、LLM 炼化），让 Next.js 主进程不被阻塞。

---

## 本地启动

```bash
nerdctl compose up -d redis
```

容器名：`alchemy-redis`，端口：`6379`

Redis 配置了 `appendonly yes`（AOF 持久化），容器重启后队列中未处理的任务不会丢失。

---

## 环境变量

```env
REDIS_URL=redis://localhost:6379
```

---

## 本项目中的队列

定义在 `src/lib/queue/index.ts`：

| 队列名 | 用途 | 任务数据 |
|--------|------|---------|
| `embed` | 将知识块文本向量化并写入 Qdrant | `{ chunkId, knowledgeBaseId }` |
| `refine` | LLM 炼化原料（待完整实现） | `{ jobId, sourceId, workspaceId, ... }` |

两个队列都配置了：
- **3 次自动重试**，指数退避（失败后 5s / 10s / 20s 再试）
- 成功任务保留最近 100 条，失败任务保留最近 50 条

---

## Worker 进程

Worker 是**独立进程**，和 Next.js 服务器分开运行：

```bash
pnpm worker
```

入口文件：`workers/index.ts`
向量化 worker：`workers/embed.worker.ts`

Worker 的逻辑：
```
从 embed 队列取任务
  → 从 MySQL 读 KnowledgeChunk.content
  → embed(content) → 512 维向量
  → 写入 Qdrant（upsertChunk）
  → 更新 MySQL KnowledgeChunk.qdrantId
```

**注意：** 开发时需要同时运行两个终端：

```bash
# 终端 1
pnpm dev

# 终端 2
pnpm worker
```

没有 Worker 运行时，知识块会停在「待向量化」状态，RAG 搜索会找不到内容。

---

## 任务是怎么入队的

知识库炼化后，API 路由会把新 chunk 的 ID 推入 `embed` 队列：

```ts
import { embedQueue } from "@/lib/queue";

await embedQueue.add("embed-chunk", {
  chunkId: chunk.id,
  knowledgeBaseId: kb.id,
});
```

Worker 进程监听这个队列，自动取出并处理。

---

## 查看队列状态

可以用 Redis CLI 直接查看：

```bash
# 进入容器
nerdctl exec -it alchemy-redis redis-cli

# 查看所有 BullMQ 相关的 key
KEYS bull:*

# 查看 embed 队列等待中的任务数
LLEN bull:embed:wait

# 查看失败任务
ZCARD bull:embed:failed
```

---

## 常见问题

**Q：知识块一直显示「待向量化」**
→ Worker 进程没有运行。执行 `pnpm worker`。

**Q：Worker 启动报错找不到 ONNX 模型**
→ 第一次运行会自动下载 bge-small-zh-v1.5 模型（~24MB），需要联网。下载完成后缓存在本地，后续无需再下载。

**Q：Redis 连接失败**
→ 检查容器是否运行：`nerdctl ps | grep redis`。如果没有，执行 `nerdctl compose up -d redis`。
