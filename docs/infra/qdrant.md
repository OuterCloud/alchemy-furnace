# Qdrant（向量数据库）

## 它是什么

Qdrant 是专门为向量搜索设计的数据库。在本项目中，它负责存储知识块的语义向量，支持「按语义相似度查找最相关的知识」——即 RAG（检索增强生成）的核心。

**一句话理解：** MySQL 存文字，Qdrant 存「文字的意思」（向量），搜索时靠意思匹配而不是关键词匹配。

---

## 本地启动

```bash
nerdctl compose up -d qdrant
```

容器名：`alchemy-qdrant`，端口：
- `6333`：HTTP REST API（代码使用）
- `6334`：gRPC（暂不使用）

---

## 环境变量

```env
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=          # 本地开发留空即可
```

---

## 可视化 Dashboard

Qdrant 内置 Web UI，启动后直接访问：

```
http://localhost:6333/dashboard
```

在这里可以：
- 查看所有集合（collections）
- 浏览 points（向量点）和它们的 payload
- 手动执行搜索测试

---

## 项目中的数据结构

### 集合（Collection）

集合名：`skill_knowledge`（启动时自动创建，无需手动操作）

```
向量维度：512
距离函数：Cosine（余弦相似度）
```

### 每个 Point 的结构

```json
{
  "id": "cma1b2c3d...",         // 等于 KnowledgeChunk.id
  "vector": [0.023, -0.117, ...],  // 512 个浮点数
  "payload": {
    "kbId": "cmx9y8z7...",      // 所属知识库 ID（用于过滤）
    "chunkId": "cma1b2c3d..."   // 回查 MySQL 用
  }
}
```

---

## 数据流向

```
用户输入知识文本
    ↓
LLM 炼化 → KnowledgeChunk 写入 MySQL（qdrantId = null）
    ↓
BullMQ embed 队列
    ↓
Worker: embed(content) → 512 维向量
    ↓
Qdrant upsert（写入向量 + payload）
    ↓
MySQL 更新 KnowledgeChunk.qdrantId = point.id
```

---

## 搜索是怎么工作的

对话时的 RAG 检索（`src/lib/vector/index.ts`）：

```ts
// 1. 将用户问题向量化
const vector = await embed(userQuestion);  // → 512 维

// 2. 在 Qdrant 中找最相似的 5 个 chunk
//    filter: 只在当前角色挂载的知识库中搜索
const hits = await searchChunks({
  vector,
  kbIds: ["kb1", "kb2"],  // 当前角色挂载的 KB
  limit: 5,
});

// 3. 用 chunkId 回查 MySQL 取完整文本
// 4. 拼接到 system prompt 中
```

`kbIds` 过滤确保不同知识库之间的数据互不干扰。

---

## 向量是怎么生成的

见 [embedder.md](./embedder.md)。简而言之：使用本地 CPU 运行的 `bge-small-zh-v1.5` 模型，无需调用外部 API。

---

## 常用操作

### 查看集合信息

```bash
curl http://localhost:6333/collections/skill_knowledge | jq
```

### 查看 point 总数

```bash
curl http://localhost:6333/collections/skill_knowledge | jq '.result.points_count'
```

### 删除集合（重置所有向量）

```bash
curl -X DELETE http://localhost:6333/collections/skill_knowledge
```

⚠️ 删除后需要重新触发所有知识块的向量化（角色编辑页 → 知识库 → 「全部重新向量化」）。同时记得把 MySQL 中所有 `KnowledgeChunk.qdrantId` 设为 null，否则状态会不一致。

---

## 数据持久化

Qdrant 数据存在 Docker volume `qdrant_data` 中：

```yaml
volumes:
  - qdrant_data:/qdrant/storage
```

容器重启数据不丢失。删除 volume 才会清空数据：

```bash
nerdctl compose down -v   # ⚠️ 会删除 mysql_data、redis_data、qdrant_data 全部 volume
```

---

## 常见问题

**Q：搜索一直返回空结果**
1. 确认 Worker 进程在运行（`pnpm worker`）
2. 在 Qdrant Dashboard 查看 `skill_knowledge` 集合的 points_count 是否大于 0
3. 检查知识块状态是否显示「已向量化」（有 `qdrantId`）

**Q：`qdrantId` 有值但搜不到**
→ 可能集合被删除后重建过，但 MySQL 里的旧 `qdrantId` 仍然存在。在角色编辑页点「重新触发向量化」重建。
