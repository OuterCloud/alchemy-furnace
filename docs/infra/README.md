# 基础设施 & 中间件索引

本目录记录项目用到的所有外部工具和中间件，帮助新成员快速上手。

## 本地依赖（Docker 容器）

这三个服务通过 `docker-compose.yml` 一键启动：

```bash
nerdctl compose up -d      # Rancher Desktop（本项目使用）
# 或
docker compose up -d       # Docker Desktop
```

| 服务 | 端口 | 文档 |
|------|------|------|
| MySQL 8.0 | 3306 | [mysql.md](./mysql.md) |
| Redis 7 | 6379 | [redis-bullmq.md](./redis-bullmq.md) |
| Qdrant | 6333 / 6334 | [qdrant.md](./qdrant.md) |

## 代码层依赖

| 组件 | 说明 | 文档 |
|------|------|------|
| Prisma v6 | MySQL ORM，类型安全的数据库访问 | [mysql.md](./mysql.md) |
| BullMQ | 基于 Redis 的异步任务队列 | [redis-bullmq.md](./redis-bullmq.md) |
| LLM Client | OpenAI SDK，兼容任意 OpenAI 协议接口，支持流式 + function calling | [llm.md](./llm.md) |
| Embedder | 本地 CPU 向量化，bge-small-zh-v1.5，512 维 | [embedder.md](./embedder.md) |

## 一键健康检查

```bash
# 检查三个容器是否都在跑
nerdctl ps --format "table {{.Names}}\t{{.Status}}"

# 快速连通性测试
curl -s http://localhost:6333/healthz    # Qdrant
redis-cli ping                           # Redis → PONG
mysql -u alchemy -palchemy_password -e "SELECT 1" alchemy_furnace 2>/dev/null && echo "MySQL OK"
```
