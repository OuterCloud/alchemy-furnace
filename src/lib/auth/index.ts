import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { customFetch, type NextAuthConfig } from "next-auth";
import type {
  OAuthConfig,
  OAuthUserConfig,
  TokenEndpointHandler,
  UserinfoEndpointHandler,
} from "next-auth/providers";

import { db } from "@/lib/db";

// ============================================================
// Feishu Profile type
// ============================================================

interface FeishuProfile {
  open_id: string;
  union_id: string;
  name: string;
  avatar_url: string;
  email?: string;
  mobile?: string;
}

/**
 * Feishu (飞书) OAuth Provider — legacy enterprise flow.
 *
 * @auth/core v0.41 ignores `token.request`; the correct hook is `[customFetch]`.
 *
 * When auth.js calls the token endpoint it uses the `[customFetch]` function
 * (if set on the provider) instead of the global `fetch`. We intercept that
 * call to run the two-step Feishu exchange:
 *   1. POST /auth/v3/app_access_token/internal  → app_access_token
 *   2. POST /authen/v1/access_token (Bearer app_access_token) → user token + embedded profile
 *
 * The embedded profile fields (name, avatar_url, open_id, union_id…) are
 * included in the token response so that `userinfo.request` can return them
 * without a second HTTP round-trip.
 */
function FeishuProvider(options: OAuthUserConfig<FeishuProfile>): OAuthConfig<FeishuProfile> {
  const appId = options.clientId ?? "";
  const appSecret = options.clientSecret ?? "";

  return {
    id: "feishu",
    name: "Feishu",
    type: "oauth",

    authorization: {
      url: "https://open.feishu.cn/open-apis/authen/v1/index",
    },

    token: {
      url: "https://open.feishu.cn/open-apis/authen/v1/access_token",
    },

    userinfo: {
      url: "https://open.feishu.cn/open-apis/authen/v1/user_info",
      async request(context: Parameters<NonNullable<UserinfoEndpointHandler["request"]>>[0]) {
        // Profile fields were embedded in the token response by our customFetch.
        return context.tokens as unknown as FeishuProfile;
      },
    },

    profile(profile: FeishuProfile) {
      return {
        id: profile.union_id ?? profile.open_id,
        name: profile.name,
        email: profile.email ?? null,
        image: profile.avatar_url,
      };
    },

    checks: ["state"],

    /**
     * Intercepts auth.js's fetch call to the token endpoint.
     * Performs the two-step Feishu exchange and returns a standard OAuth
     * token response that auth.js can parse.
     */
    [customFetch]: async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ): Promise<Response> => {
      const url = new URL(input instanceof Request ? input.url : String(input));

      // Only intercept the token exchange call.
      if (!url.pathname.endsWith("/access_token")) {
        return fetch(input, init);
      }

      // Extract the auth code from the form-encoded body that auth.js sent.
      const body = new URLSearchParams(String(init?.body ?? ""));
      const code = body.get("code") ?? "";

      // Step 1: get app-level access token
      const appTokenRes = await fetch(
        "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal",
        {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
        },
      );
      const { app_access_token } = (await appTokenRes.json()) as {
        app_access_token: string;
      };

      // Step 2: exchange auth code for user access token (response embeds profile)
      const userTokenRes = await fetch("https://open.feishu.cn/open-apis/authen/v1/access_token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${app_access_token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ grant_type: "authorization_code", code }),
      });
      const json = (await userTokenRes.json()) as {
        code: number;
        data?: Record<string, unknown>;
      };

      const data = json.data ?? {};

      // Return a standard OAuth2 token response.
      // Extra fields (name, avatar_url, open_id, union_id…) are passed through
      // so that userinfo.request can read them from context.tokens.
      return Response.json({
        access_token: data["access_token"],
        token_type: "Bearer",
        expires_in: data["expires_in"],
        ...data,
      });
    },

    ...options,
  } as unknown as OAuthConfig<FeishuProfile>;
}

// ============================================================
// WeChat Profile type
// ============================================================

interface WeChatProfile {
  openid: string;
  nickname: string;
  headimgurl: string;
  unionid?: string;
  sex?: number;
  province?: string;
  city?: string;
  country?: string;
}

/**
 * WeChat OAuth Provider (网站扫码登录).
 *
 * WeChat deviates from standard OAuth2 in two ways:
 * 1. Token exchange uses `appid` / `secret` instead of `client_id` / `client_secret`.
 * 2. Userinfo endpoint requires `openid` as a query param (not just Bearer token).
 */
function WeChatProvider(options: OAuthUserConfig<WeChatProfile>): OAuthConfig<WeChatProfile> {
  return {
    id: "wechat",
    name: "WeChat",
    type: "oauth",

    authorization: {
      url: "https://open.weixin.qq.com/connect/qrconnect",
      params: { scope: "snsapi_login", response_type: "code" },
    },

    // Custom token exchange — WeChat uses appid/secret instead of client_id/client_secret
    token: {
      url: "https://api.weixin.qq.com/sns/oauth2/access_token",
      async request(context: Parameters<NonNullable<TokenEndpointHandler["request"]>>[0]) {
        const { provider, params } = context;
        const url = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
        url.searchParams.set("appid", (provider as { clientId?: string }).clientId ?? "");
        url.searchParams.set("secret", (provider as { clientSecret?: string }).clientSecret ?? "");
        url.searchParams.set("code", (params as Record<string, string>)["code"] ?? "");
        url.searchParams.set("grant_type", "authorization_code");

        const res = await fetch(url.toString());
        const tokens = (await res.json()) as Record<string, string>;
        return { tokens };
      },
    },

    // Custom userinfo — WeChat requires openid (from token response) as query param
    userinfo: {
      url: "https://api.weixin.qq.com/sns/userinfo",
      async request(context: Parameters<NonNullable<UserinfoEndpointHandler["request"]>>[0]) {
        const tokenData = context.tokens as Record<string, string>;
        const url = new URL("https://api.weixin.qq.com/sns/userinfo");
        url.searchParams.set("access_token", tokenData["access_token"] ?? "");
        url.searchParams.set("openid", tokenData["openid"] ?? "");
        url.searchParams.set("lang", "zh_CN");

        const res = await fetch(url.toString());
        return res.json() as Promise<WeChatProfile>;
      },
    },

    profile(profile) {
      return {
        id: profile.unionid ?? profile.openid,
        name: profile.nickname,
        email: null,
        image: profile.headimgurl,
      };
    },

    checks: ["state"],
    ...options,
  } as OAuthConfig<WeChatProfile>;
}

// ============================================================
// NextAuth config
// ============================================================

const config: NextAuthConfig = {
  adapter: PrismaAdapter(db),
  providers: [
    ...(process.env["AUTH_WECHAT_ID"] && process.env["AUTH_WECHAT_SECRET"]
      ? [
          WeChatProvider({
            clientId: process.env["AUTH_WECHAT_ID"],
            clientSecret: process.env["AUTH_WECHAT_SECRET"],
          }),
        ]
      : []),
    ...(process.env["AUTH_FEISHU_ID"] && process.env["AUTH_FEISHU_SECRET"]
      ? [
          FeishuProvider({
            clientId: process.env["AUTH_FEISHU_ID"],
            clientSecret: process.env["AUTH_FEISHU_SECRET"],
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" },

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  /**
   * createUser fires once — the first time a social account is linked to a new User row.
   * We auto-create a personal workspace so the user lands in a ready state immediately.
   */
  events: {
    async createUser({ user }) {
      await db.workspace.create({
        data: {
          // e.g. "张三 的工作区"
          name: `${user.name ?? "我"} 的工作区`,
          // cuid is already URL-safe and globally unique
          slug: user.id ?? "",
          members: {
            create: {
              userId: user.id ?? "",
              role: "OWNER",
            },
          },
        },
      });
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
