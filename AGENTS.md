<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 项目记忆（迁移自 Claude Code Auto Memory，2026-10-10）

### 项目概况
- 定位: 将人的经验/知识通过 LLM 炼化为可复用 AI Skill 的商业化 SaaS
- 阶段: Phase 3 完成（数据源模块 + function calling 已落地）
- 产品功能记录: `docs/features.md`（每次开发新功能后必须更新）

### 技术栈（已确认 + 已落地）
- Framework: Next.js 16.x (App Router + Turbopack) + TypeScript strict
- DB: MySQL 8.0 + Prisma v6（Prisma v7 的 MySQL adapter 尚未发布，需 v6）
- Vector DB: Qdrant；Cache/Queue: Redis + BullMQ
- LLM: OpenAI SDK（指向内部 bridge，非官方 Anthropic SDK）— Base URL / API Key / 模型名均通过 `.env` 配置，不硬编码；默认 gpt-4o，支持多模态
- Auth: NextAuth.js v5 beta（微信 OAuth 优先，扩展性设计）
- Storage: Cloudflare R2 (AWS SDK S3-compatible)
- UI: shadcn/ui（新版用 render prop 代替 asChild）+ Tailwind CSS v4
- State: Zustand + TanStack Query；Package Manager: pnpm

### 关键技术决策记录
- Prisma v7 需 driver adapter，MySQL adapter 未发布 → 使用 Prisma v6（`prisma-client-js` generator，URL 在 schema.prisma datasource）
- shadcn/ui 新版 SidebarMenuButton 用 `render={<Link href={...} />}` 代替 `asChild`
- exactOptionalPropertyTypes 与 next-auth/sonner 等三方库不兼容，已注释掉
- Prisma `take: -N` 不支持（无 cursor 时）→ `orderBy desc + take N + slice + reverse`
- 图片存储: base64 直接存 `Message.imageUrls`（`@db.LongText`），不依赖 R2，适合截图场景
- `react-hooks/set-state-in-effect` ESLint 规则会拦截 SSR 挂载模式，需加 `// eslint-disable-next-line`
- LLM bridge 支持多模态（vision），前提是模型为多模态（如 gpt-4o）

### 环境变量
- 生产密钥在 `.env`（已 gitignore），模板在 `.env.example`
- env 校验用 `@t3-oss/env-nextjs` + Zod，文件: `src/env.ts`；代码统一 `env.VARIABLE`，不直接用 process.env

### 代码规范工具链（已配置）
- ESLint flat config (eslint.config.mjs): simple-import-sort + unused-imports + next rules
- Prettier (.prettierrc.json): @ianvs/prettier-plugin-sort-imports + tailwindcss
- Husky: pre-commit → lint-staged, commit-msg → commitlint（conventional commits）
- TypeScript strict（noUncheckedIndexedAccess, noImplicitReturns 等）

### 关键路径
- `src/env.ts`、`src/lib/db/index.ts`（Prisma 单例）、`src/lib/ai/client.ts`（LLM 单例）、`src/lib/ai/knowledge-refiner.ts`（KB 炼化）、`src/lib/auth/index.ts`（NextAuth v5 + 微信）、`src/lib/redis/index.ts`、`src/lib/queue/index.ts`（BullMQ: refine/embed）、`src/lib/storage/index.ts`（R2/S3）、`src/lib/ai/embedder.ts`（Transformers.js bge-small-zh-v1.5 512 维）、`src/lib/vector/index.ts`（Qdrant searchChunks 支持 kbIds[]）、`src/middleware.ts`、`workers/index.ts`、`workers/embed.worker.ts`

### 容器运行环境
- 使用 Rancher Desktop（containerd 引擎），不是 Docker Desktop；启动: `nerdctl compose up -d`（不是 docker compose）
- migrate dev 前需先授权: `nerdctl exec alchemy-mysql mysql -u root -proot_password -e "GRANT ALL PRIVILEGES ON *.* TO 'alchemy'@'%'; FLUSH PRIVILEGES;"`

### 开发命令
- `pnpm dev` / `pnpm build` / `pnpm type-check` / `pnpm lint(:fix)` / `pnpm format` / `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` / `pnpm worker`

### 用户偏好
- 技术选型原则: 生态最丰富；数据库: MySQL（明确指定）
- 认证: 先做微信登录，设计需支持后续扩展（Google、抖音等）
- MVP 阶段四个功能同等重要: 炼化、管理、测试、分享

### 已完成阶段（要点）
- Phase 1: Skill → Role + KnowledgeBase 解耦（migration 20260513000000_refactor_role_kb）；RAG 基础设施（embedder + Qdrant + embed worker）；`/api/roles/**` + `/api/knowledge-bases/**`
- Phase 2: 对话模块（SSE 流式 + RAG + 图片消息 base64 预览）；`Role.allowDataRequest` 数据索取开关；设置页主题切换（next-themes）
- Phase 3: 数据源模块（DataSource + RoleDataSource，migration 20260513084602_add_data_source）；`/sources/**` 列表/新建/编辑（含调试面板）；`src/lib/data-source/caller.ts`（GET → query string，POST → JSON body，超时 10s，截断 8000 字符）；RoleEditor「绑定数据源」；消息路由两次 LLM 调用（先非流式工具决策，再流式最终回复）；ChatWindow 处理 `tool_call` SSE 事件
- 下一步: 发布分享（公开 Role 链接，外部用户可直接使用）
