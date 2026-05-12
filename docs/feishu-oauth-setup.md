# 飞书 OAuth 登录接入指南

本文档记录 Alchemy Furnace 接入飞书 OAuth 登录的完整准备工作，包括飞书开放平台配置、本地开发调试、以及生产环境部署要点。

---

## 一、飞书开放平台创建应用

1. 访问 [飞书开放平台](https://open.feishu.cn)，使用管理员飞书账号登录。

2. 进入**开发者后台** → 点击右上角**创建企业自建应用**（内部使用选此类型；若面向所有飞书用户则选"应用商店应用"）。

3. 填写应用名称（如 `Alchemy Furnace`）、描述、上传图标，点击**确定创建**。

4. 创建成功后，在应用详情页的**凭证与基础信息**中获取：
   - **App ID**（形如 `cli_xxxxxxxxxx`）
   - **App Secret**（点击"查看"后复制）

---

## 二、配置重定向 URL（回调地址）

> 飞书 OAuth 完成后会把用户浏览器重定向到此地址，必须与代码中的回调路径完全一致。

进入应用详情 → **安全设置** → **重定向 URL**，点击添加：

| 环境 | 回调 URL |
|------|---------|
| 本地开发 | `http://localhost:3000/api/auth/callback/feishu` |
| 生产环境 | `https://your-domain.com/api/auth/callback/feishu` |

> **注意**：飞书支持 `http://localhost` 作为回调地址，本地开发无需 ngrok 或公网域名（这是飞书相比微信 OAuth 的重要优势）。

---

## 三、申请用户信息权限

进入应用详情 → **权限管理** → 搜索并开通以下权限：

| 权限名称 | 权限标识 | 用途 |
|---------|---------|------|
| 获取用户基本信息 | `auth.user.info` | 读取姓名、头像、open_id、union_id |
| 获取用户邮箱信息 | `contact:user.email:readonly` | 读取邮箱（可选） |

> 企业自建应用的权限修改后**立即生效**，无需审核。应用商店应用需等待审核。

> **注意**：以上是飞书开放平台的服务端 API 权限，需要在「权限管理」中开通。OAuth 授权页面使用的是标准 OIDC scope（`openid`），两者概念不同，不要混淆。

---

## 四、配置环境变量

将 App ID 和 App Secret 填入项目根目录的 `.env` 文件：

```bash
AUTH_FEISHU_ID=cli_你的AppID
AUTH_FEISHU_SECRET=你的AppSecret
```

`.env.example` 中已有对应模板，不含真实值：

```bash
AUTH_FEISHU_ID=your-feishu-app-id
AUTH_FEISHU_SECRET=your-feishu-app-secret
```

> **安全提示**：`.env` 已在 `.gitignore` 中，不会提交到代码仓库。切勿将真实密钥提交到 Git。

---

## 五、代码实现说明

### 自定义 Provider 位置

`src/lib/auth/index.ts` 中的 `FeishuProvider` 函数。

### 飞书 OAuth 与标准 OAuth 的差异

| 差异点 | 标准 OAuth 2.0 | 飞书实现 |
|--------|--------------|---------|
| Token 换取认证方式 | `client_id` / `client_secret` 在请求体 | `Authorization: Basic base64(app_id:app_secret)` |
| Token 请求格式 | `application/x-www-form-urlencoded` | `application/json` |
| Userinfo 响应结构 | 直接返回用户对象 | 包裹在 `{ data: {...} }` 中 |

### 关键 API 端点

| 步骤 | 用途 | 地址 |
|------|------|------|
| 1 | 授权（旧版，无需 scope） | `https://open.feishu.cn/open-apis/authen/v1/index` |
| 2 | 获取 App Access Token | `https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal` |
| 3 | 换取 User Access Token（含用户信息） | `https://open.feishu.cn/open-apis/authen/v1/access_token` |

> **为什么不用 OIDC 端点**：
> - `/authen/v1/authorize` 报 20043 — scope 需在开放平台后台显式开通
> - `/authen/v1/oidc/access_token` 报 20014 — 不接受 Basic auth，需要 app access token
>
> 旧版两步流程（`app_access_token` → `user access_token`）无上述限制，且 token 响应中已内嵌用户信息，无需额外调用 userinfo 端点。

### 用户身份标识

- **open_id**：用户在当前应用下的唯一 ID（换应用后变化）
- **union_id**：用户在同一企业下所有应用中的唯一 ID（推荐用于跨应用识别）

代码中使用 `union_id`（如有）作为平台用户 ID，回退到 `open_id`：

```ts
profile(profile) {
  return {
    id: profile.union_id ?? profile.open_id,
    // ...
  };
}
```

---

## 六、本地开发调试流程

1. 确认 `.env` 中 `AUTH_FEISHU_ID` 和 `AUTH_FEISHU_SECRET` 已填写。
2. 确认飞书开放平台已添加 `http://localhost:3000/api/auth/callback/feishu`。
3. 启动开发服务器：
   ```bash
   pnpm dev
   ```
4. 访问 `http://localhost:3000/login`，点击**飞书登录**。
5. 浏览器跳转到飞书授权页，扫码或账号密码登录后自动跳回。
6. 首次登录会触发 `createUser` 事件，自动创建个人工作区 `{用户名} 的工作区`。

---

## 七、生产环境部署

1. 在飞书开放平台**安全设置**中额外添加生产域名回调 URL：
   ```
   https://your-domain.com/api/auth/callback/feishu
   ```

2. 在生产环境的环境变量（如 Vercel / Docker / K8s Secret）中设置：
   ```
   AUTH_FEISHU_ID=cli_xxx
   AUTH_FEISHU_SECRET=xxx
   AUTH_SECRET=（用 openssl rand -base64 32 生成的随机字符串）
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

3. 若使用应用商店应用（面向全飞书用户），需在开放平台完成**应用发布审核**后方可使用。

