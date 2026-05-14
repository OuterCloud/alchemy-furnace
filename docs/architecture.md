# Alchemy Furnace — 架构设计文档

> 版本: v0.2
> 更新: 2026-05-14
> 状态: 已更新，反映 Phase 3 完成后现状

## 产品定位

将人的经验与知识通过 LLM「炼化」为可复用的 AI 角色（Role），支持多领域（投资分析、量化研究、经济分析等），面向商业化 SaaS。用户可通过炼化知识、挂载数据源，构建具备专业知识和动态数据获取能力的 AI 对话专家。

---

## 一、技术栈

| 层次 | 选型 | 理由 |
|---|---|---|
| 框架 | **Next.js 16.x** (App Router + Turbopack) | 最大 React 生态，全栈，Vercel 原生支持 |
| 语言 | **TypeScript** (strict mode) | 商业级必须，最大 JS 生态 |
| UI 组件 | **shadcn/ui** + Tailwind CSS v4 | 最流行的 Next.js 组件方案，可定制 |
| ORM | **Prisma v6** | MySQL 支持最完整，类型安全，迁移管理（Prisma v7 MySQL adapter 尚未发布，固定 v6）|
| 关系数据库 | **MySQL 8.0+** | 项目指定 |
| 向量数据库 | **Qdrant** | 轻量，SDK 生态好，可本地 Docker 运行 |
| 缓存/队列 | **Redis + BullMQ** | Node.js 队列生态最佳，处理异步嵌入任务 |
| LLM | **OpenAI SDK**（兼容任意 OpenAI 协议接口）| 通过环境变量配置接入地址，可对接 OpenAI、Groq、Azure OpenAI、Ollama 等；默认模型 gpt-4o，支持多模态 + function calling |
| 嵌入模型 | **bge-small-zh-v1.5** (本地 CPU) | 中文语义向量化，~24MB，@huggingface/transformers 运行 |
| 文件存储 | **Cloudflare R2** (S3 兼容) | 无出流费用，适合创业期 |
| 认证 | **NextAuth.js v5** | 支持自定义 Provider，已接入微信 + 飞书 |
| 客户端状态 | **Zustand** | 轻量，最活跃生态 |
| 服务端数据 | **TanStack Query** | 最流行的异步状态管理 |
| 包管理 | **pnpm** | 速度快，磁盘高效 |
| 容器 | **Rancher Desktop** (nerdctl) | 本地开发运行 MySQL + Redis + Qdrant |

---

## 二、项目结构

```
alchemy-furnace/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # 登录页 /login
│   │   ├── (dashboard)/              # 主应用（需登录）
│   │   │   ├── roles/                # 角色管理 /roles/**
│   │   │   ├── knowledge/            # 知识库管理 /knowledge/**
│   │   │   ├── sources/              # 数据源管理 /sources/**
│   │   │   ├── conversations/        # 对话页 /conversations/[id]
│   │   │   └── settings/             # 用户/工作区设置
│   │   └── api/                      # API Routes
│   │       ├── auth/                 # NextAuth 端点
│   │       ├── roles/                # Role CRUD + KB/DS 绑定
│   │       ├── knowledge-bases/      # KB CRUD + 炼化 + 向量化
│   │       ├── data-sources/         # DataSource CRUD + 调试
│   │       └── conversations/        # 对话 + 流式消息（SSE）
│   │
│   ├── lib/
│   │   ├── db/                       # Prisma client 单例
│   │   ├── ai/
│   │   │   ├── client.ts             # LLM 单例 (openai SDK，兼容任意 OAI 协议接口)
│   │   │   ├── embedder.ts           # bge-small-zh-v1.5 本地嵌入
│   │   │   └── knowledge-refiner.ts  # 知识炼化 prompts
│   │   ├── vector/                   # Qdrant 操作封装
│   │   ├── queue/                    # BullMQ 队列定义
│   │   ├── data-source/              # callDataSource() + buildParamSchema()
│   │   ├── storage/                  # R2/S3 文件操作封装
│   │   └── auth/                     # NextAuth 配置（微信/飞书 Provider）
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui 基础组件
│   │   ├── role/                     # 角色相关业务组件
│   │   ├── knowledge/                # 知识库相关组件
│   │   ├── sources/                  # 数据源编辑器
│   │   ├── chat/                     # 对话 UI
│   │   └── layout/                   # 布局组件（Sidebar、Header 等）
│   │
│   └── env.ts                        # 环境变量 Zod 校验 (@t3-oss/env-nextjs)
│
├── prisma/
│   ├── schema.prisma                 # 数据库 Schema
│   └── migrations/                   # 迁移历史（请提交到 git）
│
├── workers/                          # BullMQ Worker 进程（独立启动 pnpm worker）
│   ├── index.ts                      # Worker 入口
│   └── embed.worker.ts               # 向量嵌入 Worker
│
├── docs/                             # 项目文档
│   ├── architecture.md               # 本文件
│   ├── features.md                   # 产品功能记录（唯一真相来源）
│   ├── wechat-oauth-setup.md         # 微信登录接入指南
│   ├── feishu-oauth-setup.md         # 飞书登录接入指南
│   └── infra/                        # 基础设施文档
│       ├── README.md                 # 中间件索引 + 健康检查
│       ├── mysql.md                  # MySQL + Prisma
│       ├── redis-bullmq.md           # Redis + BullMQ
│       ├── qdrant.md                 # Qdrant 向量数据库
│       ├── llm.md                    # LLM 客户端
│       └── embedder.md               # 本地嵌入模型
│
├── docker-compose.yml                # 本地开发：MySQL + Redis + Qdrant
├── .env.example                      # 环境变量模板
└── package.json
```

---

## 三、核心数据模型

```prisma
// ── 认证（NextAuth 约定格式）─────────────────────────────────────
model User {
  id         String            @id @default(cuid())
  name       String?
  email      String?           @unique
  image      String?
  accounts   Account[]
  workspaces WorkspaceMember[]
  createdAt  DateTime          @default(now())
}

model Account {
  provider          String
  providerAccountId String
  accessToken       String?  @db.Text
  refreshToken      String?  @db.Text
  expiresAt         Int?
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([provider, providerAccountId])
}

// ── 多租户 ────────────────────────────────────────────────────────
model Workspace {
  id          String            @id @default(cuid())
  name        String
  members     WorkspaceMember[]
  roles       Role[]
  knowledgeBases KnowledgeBase[]
  dataSources    DataSource[]
  createdAt   DateTime          @default(now())
}

model WorkspaceMember {
  userId      String
  workspaceId String
  role        MemberRole @default(MEMBER)
  @@id([userId, workspaceId])
}

// ── 角色（可对话的 AI Agent）──────────────────────────────────────
model Role {
  id               String           @id @default(cuid())
  name             String
  description      String?          @db.Text
  systemPrompt     String           @db.LongText
  status           RoleStatus       @default(DRAFT)
  allowDataRequest Boolean          @default(false)
  workspaceId      String
  knowledgeBases   RoleKnowledgeBase[]
  dataSources      RoleDataSource[]
  conversations    Conversation[]
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
}

// ── 知识库 ────────────────────────────────────────────────────────
model KnowledgeBase {
  id          String           @id @default(cuid())
  name        String
  description String?          @db.Text
  workspaceId String
  chunks      KnowledgeChunk[]
  roles       RoleKnowledgeBase[]
  createdAt   DateTime         @default(now())
}

model KnowledgeChunk {
  id              String   @id @default(cuid())
  content         String   @db.LongText
  qdrantId        String?  // null = 待向量化
  knowledgeBaseId String
  createdAt       DateTime @default(now())
}

// ── 数据源（HTTP 工具，function calling）──────────────────────────
model DataSource {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  description String?  @db.Text
  method      String   @default("GET")
  url         String   @db.Text
  headers     Json?    // { "key": "value" }
  paramSchema Json?    // [{name, type, description, required}]
  roles       RoleDataSource[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ── 多对多关联表 ──────────────────────────────────────────────────
model RoleKnowledgeBase {
  roleId          String
  knowledgeBaseId String
  @@id([roleId, knowledgeBaseId])
}

model RoleDataSource {
  roleId       String
  dataSourceId String
  @@id([roleId, dataSourceId])
}

// ── 对话 ──────────────────────────────────────────────────────────
model Conversation {
  id        String    @id @default(cuid())
  title     String?
  userId    String
  roleId    String
  role      Role      @relation(fields: [roleId], references: [id])
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  role           MessageRole  // USER | ASSISTANT
  content        String       @db.LongText
  imageUrls      String?      @db.LongText  // base64 JSON 数组
  createdAt      DateTime     @default(now())
}

// ── 炼化原料与任务 ────────────────────────────────────────────────
model SourceMaterial { ... }    // 待炼化的原始内容
model RefinementJob  { ... }    // 异步炼化任务记录

// ── 枚举 ──────────────────────────────────────────────────────────
enum RoleStatus   { DRAFT PUBLISHED ARCHIVED }
enum MemberRole   { OWNER ADMIN MEMBER }
enum MessageRole  { USER ASSISTANT }
```

---

## 四、核心业务流程

### 知识炼化流程（输入 → 可检索知识）

```
用户在知识库详情页输入原始内容
    ↓
POST /api/knowledge-bases/[id]/refine
    ↓
LLM（expandForKnowledgeBase）整理为结构化知识文本（150-400字）
    ↓
写入 KnowledgeChunk（qdrantId = null）
    ↓
推入 BullMQ embed 队列
    ↓
Worker（pnpm worker）：embed(content) → 512 维向量
    ↓
写入 Qdrant（skill_knowledge 集合）
    ↓
更新 KnowledgeChunk.qdrantId
```

### 对话流程（含 RAG + Function Calling）

```
用户发送消息（含可选图片）
    ↓
POST /api/conversations/[id]/messages
    ↓
[RAG] embed(content) → searchChunks → top-5 chunks 注入 system prompt
    ↓
[Function Calling，仅当角色绑定了数据源]
  第一次 LLM 调用（非流式）：工具决策
    ├── finish_reason = tool_calls
    │     → SSE { type: "tool_call", name }
    │     → callDataSource(ds, args)（HTTP 请求）
    │     → 结果追加到 llmMessages
    └── finish_reason = stop → 跳过
    ↓
第二次 LLM 调用（流式）：最终回复
    ↓
逐 token → SSE { type: "delta", content }
    ↓
流结束 → 写入 ASSISTANT 消息 → SSE { type: "done" }
```

### 角色绑定流程

```
创建知识库 → 炼化内容 → 向量化
创建数据源 → 配置 HTTP 接口 + 参数定义

创建角色（DRAFT）→ 填写 systemPrompt
  → 挂载知识库（RoleKnowledgeBase）
  → 绑定数据源（RoleDataSource）
  → 发布（PUBLISHED）→ 开始对话
```

---

## 五、开发阶段规划

### Phase 0 — 基础设施 ✅

- [x] Next.js 项目初始化（TypeScript + pnpm + ESLint + Prettier + Husky）
- [x] `docker-compose.yml`（MySQL 8 + Redis + Qdrant）
- [x] Prisma 初始化 + 核心 Schema + 首次迁移
- [x] NextAuth.js v5 配置（微信 OAuth + 飞书 OAuth Provider）
- [x] shadcn/ui 安装 + Tailwind CSS v4
- [x] 环境变量管理（`.env.example` + Zod 运行时校验）
- [x] BullMQ Worker 进程框架

### Phase 1 — 角色 + 知识库 ✅

- [x] Workspace 多租户架构
- [x] Role 模块（CRUD、状态流转、发布/撤回）
- [x] KnowledgeBase 模块（CRUD、炼化、向量化）
- [x] RAG 基础设施（embedder + Qdrant + embed worker）
- [x] Role ↔ KnowledgeBase 多对多挂载

### Phase 2 — 对话模块 ✅

- [x] ChatWindow（SSE 流式输出、Markdown 渲染）
- [x] 历史对话管理（改名、删除）
- [x] 图片消息支持（Cmd+V 粘贴 + Lightbox）
- [x] `allowDataRequest` 数据索取指引（阶段 0 数据源）
- [x] 主题切换（亮色/暗色/跟随系统）

### Phase 3 — 数据源（Function Calling）✅

- [x] DataSource 模型（HTTP 工具定义）
- [x] 数据源 CRUD 界面 + 调试面板
- [x] cURL 命令导入（自动解析填充）
- [x] Role ↔ DataSource 多对多绑定
- [x] 消息路由两次 LLM 调用（工具决策 + 流式回复）
- [x] ChatWindow 工具调用状态提示

### Phase 4 — 发布分享（规划中）

- [ ] 公开 Role 链接（外部用户无需登录可对话）
- [ ] 使用配额与访问控制
- [ ] 对话统计 Dashboard

### Phase 5 — 商业化（规划中）

- [ ] 订阅计划与配额限制
- [ ] 微信支付 + Stripe
- [ ] API Key 管理（开发者接入）

---

## 六、商业化前的外部准备

| 准备项 | 说明 | 优先级 |
|---|---|---|
| 微信开放平台账号 | 注册网站应用，获取 AppID/AppSecret，需要已备案域名 | P0 |
| 飞书开放平台应用 | 创建企业自建应用，获取 App ID/Secret | P0 |
| LLM 服务接入 | 选择供应商（OpenAI / Groq / Azure OpenAI / 自托管等），配置 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL | P0 |
| 域名 | 微信 OAuth 回调必须是真实域名 | P0 |
| Cloudflare 账号 | R2 文件存储（图片/文件上传功能启用时需要）| P1 |
| Vercel 账号 | 部署 Next.js 主应用 | P1 |
| 微信支付商户号 | Phase 5 商业化时需要 | P2 |

---

## 七、关键技术决策记录

| 决策 | 选择 | 放弃的方案 | 原因 |
|---|---|---|---|
| 认证方案 | NextAuth.js v5 | Clerk | Clerk 不支持微信/飞书 OAuth，NextAuth 可自定义 Provider |
| LLM 接入 | OpenAI SDK + 标准化 OpenAI 协议 | 硬编码特定供应商 SDK | 三个环境变量即可切换供应商（OpenAI / Groq / Azure / 自托管），代码零改动 |
| 向量存储 | Qdrant | pgvector | MySQL 无原生向量支持，Qdrant 轻量可本地运行 |
| 嵌入模型 | bge-small-zh-v1.5 (本地 CPU) | 调用外部嵌入 API | 无 API 成本，隐私友好，512 维适合中文语义搜索 |
| 异步任务 | BullMQ + Redis | Inngest / Trigger.dev | Node.js 生态最成熟，自托管无额外成本 |
| 文件存储 | Cloudflare R2 | AWS S3 | 无出流费用，对创业期更友好 |
| 图片存储 | base64 直存 DB（LongText）| R2 | 截图场景体积小（<2MB），无需依赖外部存储服务 |
| ORM 版本 | Prisma v6 | Prisma v7 | v7 的 MySQL Driver Adapter 尚未发布，v6 稳定 |
| 项目结构 | Next.js 全栈单仓 | 前后端分离 | MVP 阶段优先速度，架构已预留拆分空间 |
| Function Calling 策略 | 两次 LLM 调用（决策+流式）| 单次流式含工具 | OpenAI 流式 API 工具调用需特殊处理，两次调用更清晰 |
