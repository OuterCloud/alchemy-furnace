# 微信 OAuth 登录接入指南

本文档记录 Alchemy Furnace 接入微信扫码登录（网站应用）的完整准备工作。

> **当前状态**：代码已实现，登录页按钮暂时置灰（「即将上线」）。完成本文档所有步骤并填写环境变量后，按钮将自动启用。

---

## 一、前置条件

微信网站扫码登录需要**企业资质**，个人开发者无法申请。在开始之前确认：

- 拥有已认证的微信开放平台企业账号
- 拥有已备案的公网域名（localhost 不被支持）
- 服务器可通过 HTTPS 访问（微信要求回调地址为 HTTPS）

---

## 二、微信开放平台创建网站应用

1. 访问 [微信开放平台](https://open.weixin.qq.com)，使用企业管理员账号登录。

2. 进入**管理中心** → **网站应用** → **创建网站应用**。

3. 填写应用信息：
   - 应用名称、简介、图标
   - **授权回调域**（关键）：填写已备案的域名，**不含协议和路径**，例如 `your-domain.com`

4. 提交审核，等待微信官方审核通过（通常 1～7 个工作日）。

5. 审核通过后，在应用详情页获取：
   - **AppID**（形如 `wx1234567890abcdef`）
   - **AppSecret**（点击查看后复制）

---

## 三、回调 URL 说明

微信 OAuth 回调地址格式：

```
https://your-domain.com/api/auth/callback/wechat
```

**本地开发限制**：微信不支持 `localhost` 作为回调地址，本地调试必须借助内网穿透工具将本地服务暴露到公网：

```bash
# 方案一：ngrok（需注册账号，免费版够用）
ngrok http 3000
# → 得到 https://xxxx.ngrok-free.app

# 方案二：Cloudflare Tunnel（完全免费，速度更稳定）
cloudflared tunnel --url http://localhost:3000
# → 得到 https://xxxx.trycloudflare.com
```

使用内网穿透时，还需同步修改 `.env` 中的 `NEXT_PUBLIC_APP_URL`：

```bash
NEXT_PUBLIC_APP_URL=https://xxxx.ngrok-free.app
```

并在微信开放平台将对应域名加入**授权回调域**白名单。

---

## 四、配置环境变量

```bash
AUTH_WECHAT_ID=wx你的AppID
AUTH_WECHAT_SECRET=你的AppSecret
```

填写后重启开发服务器，登录页的微信扫码按钮会自动启用。

---

## 五、代码实现说明

### 自定义 Provider 位置

`src/lib/auth/index.ts` 中的 `WeChatProvider` 函数。

### 微信 OAuth 与标准 OAuth 的差异

| 差异点 | 标准 OAuth 2.0 | 微信实现 |
|--------|--------------|---------|
| Token 换取参数名 | `client_id` / `client_secret` | `appid` / `secret` |
| Userinfo 获取方式 | Bearer Token | 需额外传 `openid` 查询参数 |
| 用户邮箱 | 通常可获取 | 不提供，返回 `null` |

### 关键 API 端点

| 用途 | 地址 |
|------|------|
| 授权（扫码页） | `https://open.weixin.qq.com/connect/qrconnect` |
| 换取 Token | `https://api.weixin.qq.com/sns/oauth2/access_token` |
| 获取用户信息 | `https://api.weixin.qq.com/sns/userinfo` |

### 用户身份标识

- **openid**：用户在当前应用下的唯一 ID
- **unionid**：用户在同一微信开放平台主体下所有应用中的唯一 ID（需应用已绑定开放平台）

代码中使用 `unionid`（如有）作为平台用户 ID，回退到 `openid`：

```ts
profile(profile) {
  return {
    id: profile.unionid ?? profile.openid,
    // ...
  };
}
```

---

## 六、生产环境部署

1. 确认生产域名已在微信开放平台的**授权回调域**白名单中。

2. 设置生产环境变量：
   ```
   AUTH_WECHAT_ID=wx你的AppID
   AUTH_WECHAT_SECRET=你的AppSecret
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

3. 微信扫码登录仅支持**微信 App 扫码**，不支持在微信内置浏览器内跳转登录。
