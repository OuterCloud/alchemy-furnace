# Alchemy Furnace — 架构设计文档

> 版本: v0.1
> 日期: 2026-05-12
> 状态: 已确认

## 产品定位

将人的经验与知识通过 LLM「炼化」为可复用的 AI Skill，支持多领域（投资分析、量化研究、经济分析等），面向商业化 SaaS。

---

## 一、技术栈

| 层次 | 选型 | 理由 |
|---|---|---|
| 框架 | **Next.js 15** (App Router) | 最大 React 生态，全栈，Vercel 原生支持 |
| 语言 | **TypeScript** | 商业级必须，最大 JS 生态 |
| UI 组件 | **shadcn/ui** + Tailwind CSS | 最流行的 Next.js 组件方案，可定制 |
| ORM | **Prisma** | MySQL 支持最完整，类型安全，迁移管理 |
| 关系数据库 | **MySQL 8.0+** | 项目指定 |
| 向量数据库 | **Qdrant** | 轻量，SDK 生态好，可本地 Docker 运行 |
| 缓存/队列 | **Redis + BullMQ** | Node.js 队列生态最佳，处理异步 LLM 任务 |
| LLM | **Claude API** (claude-sonnet-4-6) | 最强推理，原生 Anthropic SDK |
| 文件存储 | **Cloudflare R2** (S3 兼容) | 无出流费用，适合创业期 |
| 认证 | **NextAuth.js v5** | 支持自定义 Provider，可扩展微信/Google/抖音 |
| 客户端状态 | **Zustand** | 轻量，最活跃生态 |
| 服务端数据 | **TanStack Query** | 最流行的异步状态管理 |
| 表单验证 | **React Hook Form** + **Zod** | 最流行组合 |
| 包管理 | **pnpm** | 速度快，磁盘高效 |
| 测试 | **Vitest** + **Playwright** | 最现代化的测试工具链 |
| 部署 | **Vercel** + **Docker Compose**（服务） | Next.js 最佳部署平台 |

---

## 二、项目结构

采用 **Next.js 全栈单仓库**起步，内部模块化，后续可按需提取独立服务。

```
alchemy-furnace/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # 登录/注册页
│   │   ├── (dashboard)/              # 主应用（需登录）
│   │   │   ├── skills/               # Skill 管理
│   │   │   ├── sources/              # 原料上传与管理
│   │   │   ├── workspaces/           # 工作区管理
│   │   │   └── settings/             # 用户/工作区设置
│   │   └── api/                      # API Routes
│   │       ├── auth/                 # NextAuth 端点
│   │       ├── skills/               # Skill CRUD
│   │       ├── sources/              # 原料管理
│   │       ├── jobs/                 # 炼化任务状态
│   │       └── chat/                 # Skill 测试对话（streaming）
│   │
│   ├── lib/
│   │   ├── db/                       # Prisma client 单例
│   │   ├── ai/                       # Claude API 封装
│   │   ├── queue/                    # BullMQ 任务定义
│   │   ├── storage/                  # R2/S3 文件操作封装
│   │   └── auth/                     # NextAuth 配置（providers）
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui 基础组件
│   │   ├── skill/                    # Skill 相关业务组件
│   │   └── layout/                   # 布局组件（Sidebar、Header 等）
│   │
│   └── types/                        # 全局 TypeScript 类型
│
├── prisma/
│   ├── schema.prisma                 # 数据库 Schema
│   └── migrations/                   # 迁移历史
│
├── workers/                          # BullMQ Worker 进程（独立启动）
│   ├── refine.worker.ts              # LLM 炼化 Worker
│   └── embed.worker.ts               # 向量嵌入 Worker
│
├── docs/                             # 项目文档
│   └── architecture.md               # 本文件
│
├── docker-compose.yml                # 本地开发：MySQL + Redis + Qdrant
├── .env.example                      # 环境变量模板
└── package.json
```

---

## 三、核心数据模型

```prisma
// 用户
model User {
  id         String            @id @default(cuid())
  name       String?
  email      String?           @unique
  image      String?
  plan       Plan              @default(FREE)
  accounts   Account[]
  workspaces WorkspaceMember[]
  createdAt  DateTime          @default(now())
}

// OAuth 账号（支持微信/Google/抖音等多 Provider）
model Account {
  provider          String
  providerAccountId String
  accessToken       String?   @db.Text
  refreshToken      String?   @db.Text
  expiresAt         Int?
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([provider, providerAccountId])
}

// 工作区（多租户核心）
model Workspace {
  id        String            @id @default(cuid())
  name      String
  slug      String            @unique
  plan      Plan              @default(FREE)
  members   WorkspaceMember[]
  skills    Skill[]
  sources   SourceMaterial[]
  createdAt DateTime          @default(now())
}

// 工作区成员关系
model WorkspaceMember {
  userId      String
  workspaceId String
  role        MemberRole @default(MEMBER)
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  joinedAt    DateTime   @default(now())
  @@id([userId, workspaceId])
}

// Skill（核心实体）
model Skill {
  id           String         @id @default(cuid())
  name         String
  description  String?        @db.Text
  systemPrompt String         @db.LongText  // LLM system prompt
  examples     Json?                        // few-shot examples 数组
  metadata     Json?                        // 领域、标签、适用场景等
  status       SkillStatus    @default(DRAFT)
  version      Int            @default(1)
  isPublic     Boolean        @default(false)
  workspaceId  String
  workspace    Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  versions     SkillVersion[]
  jobs         RefinementJob[]
  createdById  String
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
}

// Skill 版本历史
model SkillVersion {
  id           String   @id @default(cuid())
  skillId      String
  skill        Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)
  version      Int
  systemPrompt String   @db.LongText
  examples     Json?
  changeNote   String?
  createdById  String
  createdAt    DateTime @default(now())
}

// 原料（待炼化的文档/文字）
model SourceMaterial {
  id          String          @id @default(cuid())
  type        SourceType      // PDF | URL | TEXT | AUDIO
  title       String?
  content     String?         @db.LongText
  fileUrl     String?
  fileSize    Int?
  status      ProcessStatus   @default(PENDING)
  workspaceId String
  workspace   Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  jobs        RefinementJob[]
  createdById String
  createdAt   DateTime        @default(now())
}

// 炼化任务（异步 LLM 处理）
model RefinementJob {
  id          String        @id @default(cuid())
  sourceId    String
  source      SourceMaterial @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  skillId     String?
  skill       Skill?        @relation(fields: [skillId], references: [id])
  instruction String?       @db.Text  // 用户给 LLM 的调整指令
  status      ProcessStatus @default(PENDING)
  progress    Int           @default(0)
  result      Json?
  error       String?       @db.Text
  createdById String
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

// 枚举
enum Plan            { FREE PRO ENTERPRISE }
enum MemberRole      { OWNER ADMIN MEMBER }
enum SkillStatus     { DRAFT PUBLISHED ARCHIVED }
enum SourceType      { PDF URL TEXT AUDIO }
enum ProcessStatus   { PENDING PROCESSING COMPLETED FAILED }
```

---

## 四、核心业务流程

### 炼化流程（原料 → Skill）

```
用户上传原料
  └── PDF: pdf-parse 解析文本
  └── URL: cheerio/puppeteer 抓取正文
  └── TEXT: 直接使用

→ 存入 SourceMaterial（DB）
→ 创建 RefinementJob 入队（BullMQ）
→ Worker 从队列取任务
→ 调用 Claude API 提取结构化 Skill
    Prompt: 分析原料 → 生成 name/description/systemPrompt/examples
→ 写入 Skill（DB）+ 向量嵌入（Qdrant）
→ Job 状态更新 → WebSocket/SSE 通知用户
```

### 调整流程（Skill 优化）

```
用户查看 Skill
  └── 手动编辑 → 直接保存，创建新版本
  └── AI 辅助调整：
      用户输入指令（如「让语气更严谨」「增加量化分析角度」）
      → 调用 Claude API（携带原 Skill 内容 + 用户指令）
      → 生成调整后的 Skill
      → 用户预览 → 确认保存 → 创建新版本
```

### 测试流程（Skill 对话验证）

```
用户选择 Skill → 打开测试面板
→ 输入测试问题
→ 携带 Skill.systemPrompt 调用 Claude API（streaming）
→ 流式输出响应
→ 用户评估效果 → 决定是否继续调整
```

---

## 五、开发阶段规划

### Phase 0 — 基础设施（任何业务功能之前必须完成）

- [ ] Next.js 15 项目初始化（TypeScript + pnpm + ESLint + Prettier）
- [ ] `docker-compose.yml`（MySQL 8 + Redis + Qdrant）
- [ ] Prisma 初始化 + 核心 Schema + 首次迁移
- [ ] NextAuth.js v5 配置 + 微信 OAuth Provider
- [ ] shadcn/ui 安装 + 基础设计 Token（颜色、字体）
- [ ] Cloudflare R2 / MinIO（本地）文件上传封装
- [ ] 环境变量管理（`.env.example` + Zod 运行时校验）
- [ ] GitHub Actions CI（lint + type-check + test）

### Phase 1 — MVP 全功能

- [ ] 工作区创建与切换
- [ ] 原料上传（PDF / URL / 纯文本）
- [ ] LLM 炼化 Pipeline（BullMQ Worker + Claude API）
- [ ] Skill CRUD 界面（列表、详情、编辑器）
- [ ] AI 辅助调整（对话式 refine）
- [ ] Skill 版本历史
- [ ] Skill 测试对话界面（streaming）
- [ ] Skill 发布/分享（公开链接）

### Phase 2 — 商业化

- [ ] 订阅计划与配额限制
- [ ] 微信支付 + Stripe
- [ ] Skill 市场 / 模板库
- [ ] API Key 管理（开发者接入）
- [ ] Google / 抖音 OAuth 登录

### Phase 3 — 规模化

- [ ] 团队协作（多成员编辑、评论）
- [ ] 企业级权限管理
- [ ] Skill 评测与基准测试
- [ ] 数据分析 Dashboard

---

## 六、商业化前的外部准备

| 准备项 | 说明 | 优先级 |
|---|---|---|
| 微信开放平台账号 | 注册网站应用，获取 AppID/AppSecret，需要已备案域名 | P0 |
| Anthropic API Key | LLM 核心能力 | P0 |
| 域名 | 微信 OAuth 回调必须是真实域名 | P0 |
| Cloudflare 账号 | R2 文件存储 | P1 |
| Vercel 账号 | 部署 | P1 |
| 微信支付商户号 | Phase 2 商业化时需要 | P2 |

---

## 七、关键技术决策记录

| 决策 | 选择 | 放弃的方案 | 原因 |
|---|---|---|---|
| 认证方案 | NextAuth.js v5 | Clerk | Clerk 不支持微信 OAuth，NextAuth 可自定义 Provider |
| 向量存储 | Qdrant | pgvector | MySQL 无原生向量支持，Qdrant 轻量可本地运行 |
| 异步任务 | BullMQ + Redis | Inngest / Trigger.dev | Node.js 生态最成熟，自托管无额外成本 |
| 文件存储 | Cloudflare R2 | AWS S3 | 无出流费用，对创业期更友好 |
| 项目结构 | Next.js 全栈单仓 | 前后端分离 | MVP 阶段优先速度，架构已预留拆分空间 |
