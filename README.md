# Alchemy Furnace

> 将专家经验与知识炼化为可复用 AI Skill 的商业化 SaaS 平台

通过 LLM 的力量，把投资分析师、量化研究员、经济学家等各领域专家的文档、文字和经验，提炼为结构化、可调用、可分享的 AI Skill。

---

## Tech Stack

| 层次 | 技术 |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Database | MySQL 8.0 + Prisma ORM |
| Vector DB | Qdrant |
| Queue | BullMQ + Redis |
| LLM | OpenAI-compatible API (Claude) |
| Auth | NextAuth.js v5 (WeChat OAuth) |
| Storage | Cloudflare R2 (S3-compatible) |
| UI | shadcn/ui + Tailwind CSS v4 |

## Prerequisites

- [Node.js](https://nodejs.org) >= 20
- [pnpm](https://pnpm.io) >= 9
- [Rancher Desktop](https://rancherdesktop.io) (or Docker Desktop)

## Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd alchemy-furnace
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

编辑 `.env`，填写必要的配置项（至少需要 `AUTH_SECRET` 和 `LLM_API_KEY`）：

```bash
# 生成 AUTH_SECRET
openssl rand -base64 32
```

### 3. Start Infrastructure

```bash
# Rancher Desktop (containerd)
nerdctl compose up -d

# Docker Desktop
docker compose up -d
```

### 4. Run Database Migration

```bash
pnpm db:migrate
```

### 5. Start Dev Server

```bash
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)

---

## Scripts

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动开发服务器 (Turbopack) |
| `pnpm build` | 生产构建 |
| `pnpm start` | 启动生产服务器 |
| `pnpm type-check` | TypeScript 类型检查 |
| `pnpm lint` | ESLint 检查 |
| `pnpm lint:fix` | ESLint 自动修复 |
| `pnpm format` | Prettier 格式化 |
| `pnpm db:migrate` | 执行数据库迁移 |
| `pnpm db:studio` | 打开 Prisma Studio |
| `pnpm db:generate` | 重新生成 Prisma Client |
| `pnpm worker` | 启动 BullMQ Worker 进程 |

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # 登录页
│   ├── (dashboard)/           # 主应用（需登录）
│   │   ├── dashboard/
│   │   ├── skills/            # Skill 管理
│   │   ├── sources/           # 原料上传
│   │   └── settings/
│   └── api/
│       ├── auth/              # NextAuth 端点
│       ├── skills/            # Skill CRUD API
│       ├── sources/           # 原料管理 API
│       └── chat/              # Skill 测试对话（streaming）
├── lib/
│   ├── ai/                    # LLM 客户端 + 炼化逻辑
│   ├── auth/                  # NextAuth 配置
│   ├── db/                    # Prisma client 单例
│   ├── queue/                 # BullMQ 队列定义
│   ├── redis/                 # Redis 客户端单例
│   └── storage/               # R2/S3 文件操作
├── components/
│   ├── ui/                    # shadcn/ui 基础组件
│   ├── layout/                # 布局组件
│   └── providers/             # React 全局 Provider
├── env.ts                     # 环境变量 Zod 校验
└── middleware.ts               # 路由鉴权
workers/
└── refine.worker.ts           # LLM 炼化 BullMQ Worker
prisma/
└── schema.prisma              # 数据库 Schema
```

## Core Workflow

```
上传原料 (PDF / URL / 文本)
  → 解析内容
  → BullMQ 入队
  → Worker 调用 LLM 提炼
  → 生成 Skill (name / description / systemPrompt / examples)
  → 用户审阅 → 手动编辑 或 AI 辅助调整
  → 发布 / 分享
```

## Code Standards

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org) (`feat:` / `fix:` / `chore:` ...)
- **Linting**: ESLint + Prettier，提交前自动运行（Husky + lint-staged）
- **Types**: TypeScript strict 模式，禁止 `any`

## Architecture

详见 [docs/architecture.md](docs/architecture.md)
