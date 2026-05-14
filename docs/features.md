# Alchemy Furnace — 产品功能记录

> 本文档记录所有已实现功能的 UI 逻辑、用户流程和权限规则。
> **每次新增或变更功能后必须同步更新此文档。**

---

## 目录

1. [认证模块](#1-认证模块)
2. [全局布局](#2-全局布局)
3. [设置模块](#3-设置模块)
4. [Roles 模块（角色）](#4-roles-模块角色)
5. [知识库模块](#5-知识库模块)
6. [对话模块](#6-对话模块)
7. [数据源模块](#7-数据源模块)

---

## 1. 认证模块

### 1.1 登录页 `/login`

- 支持微信扫码登录（需配置 `AUTH_WECHAT_ID` / `AUTH_WECHAT_SECRET`）
- 支持飞书登录（需配置 `AUTH_FEISHU_ID` / `AUTH_FEISHU_SECRET`）
- 未配置对应 Provider 时该登录入口自动隐藏
- 登录成功后跳转 `/dashboard`
- 已登录用户访问 `/login` 直接跳转 `/dashboard`

### 1.2 自动创建工作区

- 用户**首次**通过 OAuth 登录时触发 `createUser` 事件
- 自动创建同名个人工作区（名称格式：`{用户名} 的工作区`）
- 创建者自动获得该工作区的 `OWNER` 角色

### 1.3 会话策略

- 使用 JWT 策略（`session.strategy = "jwt"`）
- `session.user.id` 注入 JWT token，所有 API Route 通过 `auth()` 读取

### 1.4 路由保护

- `src/middleware.ts` 拦截未登录请求，重定向到 `/login`
- Dashboard 布局层 (`(dashboard)/layout.tsx`) 二次校验 session，无 session 时 `redirect("/login")`

---

## 2. 全局布局

### 2.1 侧边栏 `AppSidebar`

| 导航项 | 路径 | 图标 |
|--------|------|------|
| 角色 | `/roles` | Bot |
| 知识库 | `/knowledge` | BookOpen |
| 数据源 | `/sources` | Library |
| 设置 | `/settings` | Settings |

- 当前路径高亮：`pathname.startsWith(item.href)`
- 底部显示用户头像、姓名、邮箱
- 退出登录按钮调用 `signOut({ callbackUrl: "/login" })`
- 侧边栏头部显示 workspace 名称（取用户第一个 workspace）

**设计决策：** 不单独设置「对话」导航项，对话入口统一放在角色卡片上。`/dashboard` 和 `/conversations` 均 redirect 到 `/roles`。

### 2.2 Dashboard 布局

- Server Component，负责获取 session 和 workspace 数据后传给 `AppSidebar`
- 使用 `SidebarProvider` + `SidebarInset` 包裹子页面内容

---

## 3. 设置模块

### 3.1 设置页 `/settings`

#### 外观

- **主题切换**：亮色 / 暗色 / 跟随系统 三档，通过 `next-themes` 持久化到 `localStorage`
- 组件：`ThemeToggle`（Client Component，使用 `useTheme`）
- 初始渲染使用 `mounted` 状态防止 SSR 水合不匹配

---

## 4. Roles 模块（角色）

### 4.1 产品定位

Role（角色）是可部署的 AI 对话 Agent：
- 定义身份（systemPrompt）：描述「是谁、如何思考、如何回答」
- 挂载知识库（KnowledgeBase）：推理时按语义检索相关知识块（RAG）
- 与知识库解耦：同一个知识库可挂载到多个角色，角色不再直接拥有知识

---

### 4.2 角色列表页 `/roles`

**UI 逻辑（Server Component）：**
- 查询当前 workspace 下所有角色（`createdAt` 倒序）
- 额外查询：当前用户与每个已发布角色的最近一条对话（`distinct roleId + orderBy updatedAt desc`）
- 将 `latestConversationId` 传入每张角色卡片

**角色卡片 `RoleCard`：**
- 卡片主体（Bot 图标 + 名称 + 状态徽章 + 描述）：整体可点击，跳转 `/roles/[id]` 编辑页
- 底部「开始对话」按钮（仅 `PUBLISHED` 状态显示）：
  - 有历史对话 → 直接跳转最近一条 `/conversations/[id]`（无网络请求）
  - 无历史对话 → `POST /api/conversations { roleId }` 创建新对话后跳转

**空状态：**
- 无角色时显示引导区域（虚线边框 + 图标 + 说明 + CTA 按钮）
- CTA 按钮跳转 `/roles/new`

**权限：** 需登录，无 workspace 时显示空状态

---

### 4.3 新建角色 `/roles/new`

**UI 逻辑：**
- Server Component 壳 + `CreateRoleForm` 客户端组件
- 表单字段：
  - **名称**（必填）
  - **描述**（可选）
- 点「创建角色」→ `POST /api/roles` → 跳转 `/roles/[id]`
- 回车键在名称输入框可触发创建

---

### 4.4 角色详情/编辑页 `/roles/[id]`

**UI 逻辑：**
- Server Component 获取角色数据、已挂载 KB 列表、workspace 全部 KB 后，渲染 `RoleEditor` 客户端组件

**RoleEditor 组件结构（从上到下）：**

```
1. 名称输入框
2. 描述文本域
3. 系统提示词文本域（大，静态编辑）
4. 允许向用户索取数据（开关，见 3.9）
5. 示例对话（可增删）
6. 操作栏：[保存草稿] [发布 / 撤回为草稿]
7. 挂载的知识库 section（可折叠展开 chunks）
8. 危险区域（仅管理员）：[删除]
```

**设计决策：**
- 炼化功能从角色编辑页剥离，移入知识库模块（`/knowledge/[id]`）
- systemPrompt 为纯静态编辑区，用户手动填写或后续由 AI 起草接口填入
- 知识库挂载/解除挂载直接在角色编辑页操作

---

### 4.5 挂载知识库

**触发：** 点击 RoleEditor 内「挂载知识库」按钮，Dialog 弹出 workspace 内可挂载的 KB 列表（已挂载的不显示）

**操作流程：**
1. 点「挂载」→ `POST /api/roles/[id]/knowledge-bases` `{ knowledgeBaseId }`
2. 服务端用 `upsert` 写入 `role_knowledge_bases` 表（幂等）
3. 前端乐观更新已挂载列表，关闭 Dialog，同步调用 `router.refresh()` 刷新服务端数据

**空状态（无可挂载 KB）：**
- 显示虚线边框卡片 + BookOpen 图标 + 说明文字
- 说明文字中「知识库」为可点击链接，直接跳转 `/knowledge`，与 Dialog description 形成视觉层次区分

**解除挂载：**
- 点角色 KB 列表中 Link2Off 图标 → `DELETE /api/roles/[id]/knowledge-bases/[kbId]`
- 仅删除关联记录，不删除知识库本身

---

### 4.6 状态流转机制

状态代表「可见性」，与角色编辑解耦。规则与原 Skills 模块一致：

```
    DRAFT ──────────────→ PUBLISHED
      ↑                       │
      │ 撤回为草稿              │ 归档
      └───────────────────────┘
                               ↓
                           ARCHIVED
                               │ 恢复为草稿
                               ↓
                            DRAFT
```

| 状态 | 编辑 | 保存 | 挂载 KB | 对话入口 | 可用操作 |
|------|------|------|---------|---------|---------|
| DRAFT | ✅ | 内容更新 | ✅ | ❌ 不显示「开始对话」 | 保存草稿 / 发布 |
| PUBLISHED | ✅ | 内容更新，**立即生效** | ✅ | ✅ 角色卡片显示按钮 | 保存 / 撤回草稿 / 归档 |
| ARCHIVED | ❌ 只读 | 不可操作 | ❌ | ❌ | 恢复为草稿 |

---

### 4.7 删除角色

**权限：** 仅 OWNER / ADMIN 可删除
**流程：** Dialog 二次确认 → `DELETE /api/roles/[id]` → 跳转 `/roles`

---

### 4.8 允许向用户索取数据（阶段 0 数据源）

**字段：** `Role.allowDataRequest: Boolean`（默认 `false`）

**UI：** 角色编辑页「系统提示词」与「示例对话」之间的 Switch 开关

**效果：** 开启后，每次对话调用 LLM 时，在 system prompt 末尾自动追加以下固定指令：

```
当你判断需要真实数据才能给出准确分析时，不要编造数据，
请明确告知用户需要提供哪些具体数据，说明每项数据的作用和格式要求，等用户提供后再给出分析结论。
```

**设计决策：**
- 零基础设施成本：纯 system prompt 指令，无需额外 LLM 调用或 function calling
- 不修改角色的 `systemPrompt` 字段，指令在运行时动态追加，保持数据干净
- 这是数据源功能的最小可用形态（阶段 0），后续阶段将支持配置 HTTP API 数据源并自动注入

---

### 4.9 API 权限矩阵

| 接口 | 方法 | 所需角色 | 说明 |
|------|------|----------|------|
| `/api/roles` | GET | 任意成员 | 获取当前 workspace 下所有 Role |
| `/api/roles` | POST | 任意成员 | 创建新 Role |
| `/api/roles/[id]` | GET | 任意成员 | 获取单个 Role |
| `/api/roles/[id]` | PUT | 任意成员 | 更新 Role（含 status 变更）|
| `/api/roles/[id]` | DELETE | OWNER/ADMIN | 删除 Role |
| `/api/roles/[id]/knowledge-bases` | GET | 任意成员 | 获取已挂载 KBs |
| `/api/roles/[id]/knowledge-bases` | POST | 任意成员 | 挂载 KB |
| `/api/roles/[id]/knowledge-bases/[kbId]` | DELETE | 任意成员 | 解除挂载 |

---

## 5. 知识库模块

### 5.1 产品定位

KnowledgeBase（知识库）是 workspace 级独立知识存储单元：
- 不依附于任何角色，可被多个角色复用
- 通过炼化 API 将原始文本转为结构化知识块（KnowledgeChunk）
- 每个知识块向量化后存入 Qdrant，在对话时按语义相似度检索

---

### 5.2 知识库列表页 `/knowledge`

**UI 逻辑：**
- Server Component，fetch workspace 下所有 KB（含 chunk 数量）
- 每个 KB 以卡片展示：名称 + 描述 + chunk 数量
- CTA 按钮跳转 `/knowledge/new`

---

### 5.3 新建知识库 `/knowledge/new`

**UI 逻辑：**
- 纯客户端页面（Client Component）
- 表单字段：名称（必填）、描述（可选）
- 点「创建知识库」→ `POST /api/knowledge-bases` → 跳转 `/knowledge/[id]`

---

### 5.4 知识库详情页 `/knowledge/[id]`

**UI 逻辑：**
- Server Component 获取 KB 及所有 chunks，渲染 `KnowledgeBaseEditor` 客户端组件

**KnowledgeBaseEditor 组件结构：**

```
1. 基本信息编辑区：名称输入框 + 描述文本域 + 「保存」按钮
2. 炼化输入区（textarea + 「炼化并存入知识库」按钮）
3. 知识块列表（创建时间 + 向量化状态 Badge）
4. 危险区域（仅管理员）：[删除知识库]
```

**知识库名称/描述修改：**
- 支持直接在详情页编辑名称和描述
- 点「保存」→ `PUT /api/knowledge-bases/[id]` `{ name, description }`
- 保存后调用 `router.refresh()` 刷新页头显示的名称/描述
- 名称为必填项，空字符串时 toast 提示并阻止提交

---

### 5.5 知识块 AI 优化

**触发：** 点击知识块列表中的眼睛图标 → 弹出编辑 Dialog → 底部「AI 优化」区域

**流程：**
1. 可选填写优化指令（如「补充具体操作步骤」「精简冗余内容」）
2. 点「AI 优化」→ `POST /api/knowledge-bases/[id]/chunks/[chunkId]/optimize` `{ instruction? }`
3. 服务端调用 `optimizeChunk(content, instruction)` —— LLM 在保留原意的前提下优化文本
4. 优化结果填入 textarea，用户确认后点「保存并重新向量化」

**设计原则：** 优化结果仅预填，不自动保存——用户有完整控制权。

---

### 5.6 知识块手动向量化

**触发条件：** 知识块 `qdrantId === null`（待向量化状态）时，chunk 行右侧显示 BrainCircuit 图标按钮

**操作：** 点按钮 → `POST /api/knowledge-bases/[id]/chunks/[chunkId]/embed` → 将该 chunk 加入 BullMQ embed 队列

**与批量向量化的区别：**
- 单块：每个未向量化块独立触发，精准控制
- 批量（「全部重新向量化」）：一次性重新触发所有 `qdrantId === null` 的块

**注意：** 两者均需 Worker 进程在运行（`pnpm worker`）才会实际执行嵌入。

---

### 5.7 炼化流程

#### 5.7.1 文字输入炼化

**触发：** 点「炼化并存入知识库」按钮

**服务端处理（`POST /api/knowledge-bases/[id]/refine`）：**
1. 并行调用 `expandForKnowledgeBase(content)` + `generateChunkTitle(content)` — LLM 整理为结构化知识内容，并自动生成标题（≤15字）
2. 同步写入 `KnowledgeChunk`（`qdrantId = null`）
3. 将 chunk 加入 `embed` BullMQ 队列
4. 返回 `{ chunkId, content, title }`

**前端处理：**
- 清空输入框
- 乐观更新：在列表头部插入新 chunk（状态「待向量化」）
- toast 提示「已炼化并存入知识库，正在向量化…」

#### 5.7.2 PDF 文件上传炼化

**触发：** 点「上传 PDF 文件炼化」按钮，选择 .pdf 文件

**服务端处理（`POST /api/knowledge-bases/[id]/upload`，Node.js runtime）：**
1. 接收 multipart/form-data，提取 `file` 字段
2. 使用 `pdf-parse` 库解析 PDF，提取纯文本（仅支持文本型 PDF，不支持扫描版）
3. 按双换行符拆分为段落，累积至 ~2000 字/段，最多 20 段
4. 对每段并行调用 `expandForKnowledgeBase` + `generateChunkTitle`
5. 批量创建 `KnowledgeChunk` 记录，逐个加入 `embed` 队列
6. 返回 `{ count, chunks[] }`

**前端处理：**
- 上传期间按钮显示「正在处理「{文件名}」…」及提示文字
- 成功后在列表头部批量插入所有新 chunk
- toast 提示「已从 PDF 提取 N 个知识块，正在向量化…」

**限制：**
- 最多提取 20 段（超出部分自动截断）
- 仅支持文本型 PDF（非扫描图像 PDF）
- 单次上传处理时间与 PDF 长度及段数成正比

**知识块生命周期：**
1. **保存**：refine API 同步创建 chunk（`qdrantId = null`）
2. **嵌入**：BullMQ `embed` worker 异步处理：取 content → 生成向量 → 写入 Qdrant → 更新 `qdrantId`
3. **状态显示**：有 `qdrantId` → 「已向量化」；无 → 「待向量化」
4. **删除**：调用 `DELETE /api/knowledge-bases/[id]/chunks/[chunkId]`，同步删除 Qdrant 向量点

---

### 5.8 嵌入模型

- 模型：`Xenova/bge-small-zh-v1.5`（约 24MB，CPU-only）
- 维度：512，余弦相似度
- 运行位置：BullMQ worker 进程，不占用 Next.js 服务器
- Qdrant 集合名：`skill_knowledge`，payload 字段：`kbId`、`chunkId`

---

### 5.9 向量搜索

`searchChunks({ vector, kbIds: string[] })` — 支持跨多个 KB 搜索（`should` filter），通常传入角色当前挂载的所有 KB ID。

---

### 5.10 API 权限矩阵

| 接口 | 方法 | 所需角色 | 说明 |
|------|------|----------|------|
| `/api/knowledge-bases` | GET | 任意成员 | 列出 workspace 下所有 KB |
| `/api/knowledge-bases` | POST | 任意成员 | 新建 KB |
| `/api/knowledge-bases/[id]` | GET | 任意成员 | 获取 KB 详情 |
| `/api/knowledge-bases/[id]` | PUT | 任意成员 | 更新 KB 名称/描述 |
| `/api/knowledge-bases/[id]` | DELETE | 任意成员 | 删除 KB（含 Qdrant 向量）|
| `/api/knowledge-bases/[id]/refine` | POST | 任意成员 | 文字输入炼化为知识块 |
| `/api/knowledge-bases/[id]/upload` | POST | 任意成员 | PDF 文件上传并批量炼化 |
| `/api/knowledge-bases/[id]/chunks` | GET | 任意成员 | 列出 KB 下所有 chunks |
| `/api/knowledge-bases/[id]/chunks/[cid]` | DELETE | 任意成员 | 删除单个 chunk（含 Qdrant）|
| `/api/knowledge-bases/[id]/chunks/[cid]` | PUT | 任意成员 | 更新 chunk 内容/标题（内容变更时重新向量化）|
| `/api/knowledge-bases/[id]/reembed` | POST | 任意成员 | 重新触发待向量化 chunks 的嵌入 |

---

## 6. 对话模块

### 6.1 产品定位

对话模块允许用户与已发布的 Role 进行实时对话：
- 仅 **PUBLISHED** 状态的角色可以发起对话，入口在角色卡片上
- 每次对话创建独立的 `Conversation` 记录，保存完整历史消息
- 推理时自动使用 RAG 检索 Role 挂载的 KB，提供知识增强的回答
- 流式输出（SSE），用户实时看到 ASSISTANT 的打字效果

---

### 6.2 对话入口（角色卡片）

没有独立的对话列表页面，对话从角色列表页 `/roles` 发起。

**「开始对话」按钮行为：**
- 服务端预查询当前用户与每个角色的最近对话（`distinct roleId + orderBy updatedAt desc`）
- **有历史对话** → 直接 `router.push("/conversations/[latestId]")`，无需创建（零延迟跳转）
- **无历史对话** → `POST /api/conversations { roleId }` 新建后跳转

**权限：** 仅 `PUBLISHED` 角色显示此按钮

---

### 6.3 聊天页面 `/conversations/[conversationId]`

**Server Component 职责：**
- 验证 `conversation.userId === session.user.id`（所有权校验，不同用户互不可见）
- 加载对话 + role 信息（name、systemPrompt）+ 完整历史消息
- 额外查询：当前用户与同一 role 的所有对话（按 `updatedAt desc`，含 `title` 和第一条用户消息）
- 将全部数据传给 `ChatWindow` 客户端组件

**`ChatWindow` 组件结构（Client Component）：**

```
顶部：← 返回 /roles | 角色名 | [History 图标]
消息区：消息气泡列表 + 流式 ASSISTANT bubble（自动滚动）
底部：Textarea（Enter 发送，Shift+Enter 换行）+ 发送按钮
```

**消息气泡样式：**
- USER：右对齐，`bg-primary text-primary-foreground`，纯文本（whitespace-pre-wrap）
- ASSISTANT：左对齐，`bg-muted text-foreground`，**Markdown 渲染**（react-markdown + remark-gfm）
- 流式中：实时 Markdown 渲染 + 无内容时占位动画（`···`）
- 发送中：输入框和发送按钮禁用

---

### 6.4 历史对话 Sheet

**触发：** 点击顶部 History 图标，左侧 Sheet 弹出

**内容：**
- 标题：「与「{角色名}」的历史对话」
- 「新建对话」按钮（`POST /api/conversations` → 跳转新对话）
- 对话列表，每条显示：标题（或第一条用户消息，或「空对话」）+ 相对时间
- 当前对话条目高亮

**对话标题优先级：** 自定义 `title` > 第一条用户消息内容 > `"空对话"`

**改名（内联编辑）：**
1. hover 出现铅笔图标 → 点击进入编辑态（input 自动 focus + select）
2. Enter 或失焦 → `PATCH /api/conversations/[id] { title }` → 乐观更新本地列表
3. Esc → 取消，恢复原值
4. 空字符串提交 → 清除自定义标题（存 `null`，回退到消息预览）

**删除：**
1. hover 出现垃圾桶图标 → 点击 → `DELETE /api/conversations/[id]`
2. 乐观从列表移除
3. 若删除的是当前对话 → 跳转到同角色下一条对话，无则跳转 `/roles`

**权限隔离：** 服务端按 `userId` 过滤，不同用户的对话完全隔离

---

### 6.5 流式消息发送（SSE）

**输入区支持：**
- 文字输入：Textarea，Enter 发送，Shift+Enter 换行
- **粘贴截图**：在 Textarea 上 Cmd/Ctrl+V 粘贴图片 → `onPaste` 拦截 → FileReader 转 base64 → 显示缩略图预览
- 缩略图可单独删除（× 按钮）
- 发送按钮启用条件：有文字 OR 有待发图片

**`handleSend()` 流程：**
1. 乐观追加 USER 消息（含 `imageUrls`）到本地 state（临时 ID）
2. 清空输入框和待发图片
3. `POST /api/conversations/[id]/messages { content, images? }`
4. 读取 `response.body`（ReadableStream），按行解析 SSE：
   - `{"type":"delta","content":"..."}` → 追加到 `streamingContent`
   - `{"type":"done","messageId":"..."}` → 将完整内容加入 messages，清空 streaming 状态
5. 失败时：移除乐观消息，**恢复** `pendingImages`，toast 提示

---

### 6.6 图片消息支持

**DB 字段：** `Message.imageUrls String? @db.LongText`，存储 base64 data URL 的 JSON 数组（`null` 表示无图片）

**存储方案：** base64 直接存 DB，不依赖 R2。适合截图场景（单图通常 < 2MB，LongText 上限 4GB）。

**前端展示：**
- USER 气泡：图片显示在文字上方，`max-h-48 object-contain`，支持多图
- 历史消息刷新后图片从 DB 恢复显示
- 点击任意图片 → Lightbox 全屏展示（黑色半透明背景 + 原图居中）；点击任意区域或按 Esc 关闭
- 待发缩略图同样支持点击 Lightbox 预览

**LLM 多模态格式：**
```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "帮我看看这张图" },
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
  ]
}
```
仅当前消息包含图片，历史消息仍以纯文本传递给 LLM（简化处理，避免重复传输大体积 base64）。

**前提：** 配置的 LLM 必须使用支持多模态（vision）的模型（如 gpt-4o），否则图片内容会被忽略。

---

### 6.7 `POST /api/conversations/[id]/messages` 核心逻辑

**请求体：** `{ content?: string, images?: string[] }`，content 和 images 至少提供一个。

1. 鉴权 + 所有权校验
2. 写入 USER 消息到 DB（含 `imageUrls`，若有图片）
3. **RAG**（仅当 role 挂载了 KB **且 content 非空**）：
   - `embed(content)` → 512 维向量
   - `searchChunks({ vector, kbIds, limit: 5 })` → top-5 相似 chunks
   - 取 chunk 内容，拼接 `ragContext` 注入 system prompt 末尾
   - RAG 失败为非致命错误，直接跳过继续推理
4. 取最近 10 条历史消息作为上下文（`orderBy desc, take 11, slice(1,11), reverse`）
5. 构造 system content：`systemPrompt + [dataRequestInstruction?] + [ragContext?]`
   - `dataRequestInstruction`：当 `role.allowDataRequest = true` 时追加数据索取指引
   - `ragContext`：RAG 检索结果（仅当 role 挂载了 KB 且有命中时）
6. 构造用户消息内容：有图片时为多模态数组，无图片时为纯文本字符串
7. `llm.chat.completions.create({ stream: true })` 流式调用
8. 每个 delta token → SSE `{"type":"delta","content":"..."}`
9. 流结束 → 写入 ASSISTANT 消息 + 更新 `conversation.updatedAt` → SSE `{"type":"done","messageId":"..."}`

**注意：** 不加 `export const runtime = "edge"`，embedder 依赖 Node.js ONNX runtime。

---

### 6.8 API 权限矩阵

| 接口 | 方法 | 所需权限 | 说明 |
|------|------|----------|------|
| `/api/conversations` | POST | 已登录用户 | 创建对话（role 须 PUBLISHED 且属当前 workspace）|
| `/api/conversations/[id]` | PATCH | 对话所有者 | 修改对话标题（空字符串清空为 null）|
| `/api/conversations/[id]` | DELETE | 对话所有者 | 删除对话（cascade 删除所有消息）|
| `/api/conversations/[id]/messages` | POST | 对话所有者 | 发送消息（含可选图片），返回 SSE 流式响应 |

---

## 7. 数据源模块

### 7.1 产品定位

DataSource（数据源）是 workspace 级 HTTP 工具定义，角色可绑定多个数据源。对话时 LLM 通过 function calling 自主决定是否调用某个工具，服务端执行 HTTP 请求并将结果注入 LLM 上下文完成最终回复，实现数据驱动的智能对话。

| 阶段 | 说明 | 状态 |
|------|------|------|
| 阶段 0 | LLM 主动向用户索取数据（通过 `Role.allowDataRequest` 系统提示词指引） | ✅ 已完成（见 3.9）|
| 阶段 1（已完成） | 配置 HTTP 数据源，LLM function calling 按需拉取 | ✅ 已完成 |

---

### 7.2 数据源列表页 `/sources`

**UI 逻辑（Server Component）：**
- 查询当前 workspace 下所有 DataSource（`createdAt` 倒序）
- 每张卡片展示：HTTP Method badge（颜色区分）+ 名称 + 描述 + URL 预览
- 点击卡片 → 跳转 `/sources/[id]` 编辑页
- 右上角「新建数据源」按钮 → 跳转 `/sources/new`
- 空状态：虚线边框 + 说明文字 + CTA 按钮

---

### 7.3 新建数据源 `/sources/new`

**UI 逻辑：**
- Server Component 壳 + `SourceEditor`（创建模式，无 initialData）
- 填写信息后点「创建数据源」→ `POST /api/data-sources` → 跳转 `/sources/[id]`

---

### 7.4 编辑数据源 `/sources/[id]`

**Server Component** 获取数据源，渲染 `SourceEditor`（编辑模式）。

**`SourceEditor` 组件结构（Client Component）：**

```
1. 基本信息：名称（必填）+ 描述（textarea，LLM 据此决定是否调用）
2. 接口配置：HTTP Method select + URL 输入框 + Headers 行编辑器
3. 参数定义：表格（参数名/类型/描述/必填），Add/Delete 行
   - 参数名校验：/^[a-z][a-z0-9_]*$/
   - 类型：string | number | boolean
4. 保存按钮（创建 / 更新）
5. 调试面板（仅编辑模式）：
   - 根据 paramSchema 动态生成输入框
   - 「发送请求」→ POST /api/data-sources/[id]/test { args }
   - 展示 result 或 error（monospace 样式）
6. 危险区域（仅编辑模式）：删除按钮 + 二次确认 Dialog
```

---

### 7.5 绑定数据源到角色

**触发：** 在角色编辑页 `/roles/[id]` 的「绑定的数据源」section 中点击「绑定数据源」

**操作流程：**
1. Dialog 弹出工作区内未绑定的数据源列表（含 Method badge + 名称 + 描述）
2. 点「绑定」→ `POST /api/roles/[id]/data-sources` `{ dataSourceId }`
3. 服务端用 `upsert` 写入 `role_data_sources` 表（幂等）
4. 前端乐观更新已绑定列表

**解绑：**
- 点 Link2Off 图标 → `DELETE /api/roles/[id]/data-sources/[dsId]`
- 仅删除关联记录，不删除数据源本身

**空状态（无可绑定数据源）：**
- 显示虚线边框卡片 + 说明文字 + 「数据源」模块跳转链接

---

### 7.6 对话中的 Function Calling 流程

对话时若角色绑定了数据源（`role.dataSources.length > 0`），消息路由采用**两次 LLM 调用**策略：

**第一次调用（非流式，工具决策）：**
1. 构建 `tools` 数组：每个数据源对应一个 `function` 工具，`name = ds.id`，`parameters` 由 `buildParamSchema(paramSchema)` 转换
2. `llm.chat.completions.create({ tools, tool_choice: "auto" })`
3. 若 `finish_reason === "tool_calls"`：
   - 解析 `tool_calls[0].function.name`（= dsId）和 `arguments`
   - 发送 SSE `{ type: "tool_call", name: ds.name }` → 前端显示「正在调用「{name}」…」
   - `callDataSource(ds, args)` 执行 HTTP 请求（GET → query string，POST/PUT/PATCH → JSON body）
   - 超时 10s，截断 >8000 字符
   - 将 `assistant(tool_calls) + tool(result)` 追加到 llmMessages

**第二次调用（流式，最终回复）：**
4. 携带工具结果继续流式输出
5. 每个 token → SSE `{ type: "delta", content: "..." }`
6. 流结束 → 写入 DB + SSE `{ type: "done" }`

**注意：** MVP 阶段只处理第一个工具调用，不递归；若 LLM 不触发工具调用，直接执行第二次流式调用。

---

### 7.7 `callDataSource()` 行为

- **GET / DELETE**：参数拼接 query string
- **POST / PUT / PATCH**：参数作为 JSON body，自动设置 `Content-Type: application/json`
- **自定义 Headers**：从 `DataSource.headers` 读取，覆盖请求头
- **超时**：AbortController，10 秒
- **截断**：响应超过 8000 字符时截断并追加 `\n...[截断]`

---

### 7.8 API 权限矩阵

| 接口 | 方法 | 所需权限 | 说明 |
|------|------|----------|------|
| `/api/data-sources` | GET | 任意成员 | 列出 workspace 下所有数据源 |
| `/api/data-sources` | POST | 任意成员 | 创建数据源（name/url 必填）|
| `/api/data-sources/[id]` | GET | 任意成员 | 获取数据源详情 |
| `/api/data-sources/[id]` | PUT | 任意成员 | 更新数据源 |
| `/api/data-sources/[id]` | DELETE | 任意成员 | 删除数据源（级联删除绑定关系）|
| `/api/data-sources/[id]/test` | POST | 任意成员 | 调试执行（`{ args }` → `{ result }` 或 `{ error }`）|
| `/api/roles/[id]/data-sources` | POST | 任意成员 | 绑定数据源到角色（幂等 upsert）|
| `/api/roles/[id]/data-sources/[dsId]` | DELETE | 任意成员 | 解绑数据源 |

---

### 7.9 关键设计决策

- **工具名 = ds.id（cuid）**：cuid 格式合法作为 OpenAI function name，同时避免名称冲突
- **描述驱动调用决策**：`description` 字段是 LLM 判断是否调用的依据，写得越准确，召回越精准
- **非递归 MVP**：只处理第一个 tool call，不支持链式调用；满足大多数单次查询场景
- **调试面板**：内嵌于编辑页，无需切换到专用测试环境，降低开发调试摩擦
- **数据源与角色解耦**：同一数据源可被多个角色复用（`RoleDataSource` 多对多关联）
