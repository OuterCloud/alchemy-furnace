# MySQL 8.0 + Prisma v6

## 它是什么

**MySQL** 是项目的主关系数据库，存储所有业务数据（用户、工作区、角色、知识库、对话、消息等）。

**Prisma** 是 ORM（对象关系映射），提供类型安全的数据库访问，负责 Schema 定义和迁移管理。

---

## 本地启动

```bash
nerdctl compose up -d mysql
```

容器名：`alchemy-mysql`，端口：`3306`

### 首次初始化（仅需一次）

Prisma migrate 需要 `CREATE/DROP` 权限，默认的 `alchemy` 用户权限不够，需要先授权：

```bash
nerdctl exec alchemy-mysql \
  mysql -u root -proot_password \
  -e "GRANT ALL PRIVILEGES ON *.* TO 'alchemy'@'%'; FLUSH PRIVILEGES;"
```

然后执行迁移：

```bash
pnpm db:migrate
```

---

## 环境变量

```env
DATABASE_URL="mysql://alchemy:alchemy_password@localhost:3306/alchemy_furnace"
```

---

## 常用命令

| 命令 | 作用 |
|------|------|
| `pnpm db:migrate` | 创建并执行新迁移（需要先改 schema.prisma）|
| `pnpm db:generate` | 重新生成 Prisma Client（改完 schema 但不想跑迁移时用）|
| `pnpm db:studio` | 打开 Prisma Studio（可视化数据浏览器，`http://localhost:5555`）|

---

## Schema 在哪

`prisma/schema.prisma` — 所有表结构都在这里定义。

核心模型：

```
User / Account / Session          ← 认证相关（NextAuth 约定格式）
Workspace / WorkspaceMember       ← 多租户
Role / RoleKnowledgeBase          ← 可对话的 AI Agent
  └─ RoleDataSource               ← 绑定的 HTTP 数据源
KnowledgeBase / KnowledgeChunk    ← 知识库 + 向量块
DataSource                        ← HTTP 工具定义（function calling）
Conversation / Message            ← 对话历史
SourceMaterial / RefinementJob    ← 炼化原料 + 任务
```

---

## 如何修改表结构

1. 编辑 `prisma/schema.prisma`
2. 运行 `pnpm db:migrate`，输入迁移名称（如 `add_user_avatar`）
3. Prisma 自动生成 SQL 并执行，同时更新 Client 类型

迁移文件保存在 `prisma/migrations/`，**请提交到 git**，这是数据库变更的唯一记录。

---

## 如何查询数据

代码中统一用单例：

```ts
import { db } from "@/lib/db";

// 查询
const role = await db.role.findFirst({
  where: { id, workspaceId },
  include: { knowledgeBases: true },
});

// 创建
const msg = await db.message.create({
  data: { conversationId, role: "USER", content },
});
```

---

## 注意事项

- **Prisma v6**：项目固定用 v6，v7 的 MySQL adapter 尚未发布，不要升级
- **`take: -N`**：Prisma v6 不支持无 cursor 的负数 take，需要 `orderBy desc + take N + reverse`
- **`@db.LongText`**：长文本字段（如 `content`、`imageUrls`）必须加这个注解，否则 MySQL 默认 VARCHAR(191) 存不下

---

## 可视化查看数据

```bash
pnpm db:studio
# 浏览器打开 http://localhost:5555
```

或者直接连 MySQL：

```bash
nerdctl exec -it alchemy-mysql mysql -u alchemy -palchemy_password alchemy_furnace
```
