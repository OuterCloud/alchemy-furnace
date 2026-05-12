import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";

import { signIn } from "@/lib/auth";
import { FeishuIcon } from "@/components/icons/feishu-icon";
import { WeChatIcon } from "@/components/icons/wechat-icon";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Login",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <FlaskConical className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Alchemy Furnace</h1>
            <p className="text-sm text-muted-foreground">将知识炼化为 AI Skill 的工作台</p>
          </div>
        </div>

        {/* Login card */}
        <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1 text-center">
            <h2 className="text-base font-semibold">登录你的账户</h2>
            <p className="text-xs text-muted-foreground">选择登录方式继续</p>
          </div>

          {/* Error message */}
          <ErrorMessage searchParams={searchParams} />

          {/* Feishu login button (Server Action) */}
          <form
            action={async () => {
              "use server";
              await signIn("feishu", { redirectTo: "/dashboard" });
            }}
          >
            <Button type="submit" className="w-full gap-2" size="lg">
              <FeishuIcon className="h-5 w-5" />
              飞书登录
            </Button>
          </form>

          {/* WeChat — coming soon */}
          <Button type="button" variant="outline" size="lg" className="w-full gap-2" disabled>
            <WeChatIcon className="h-5 w-5" />
            微信扫码登录
            <span className="ml-auto text-xs text-muted-foreground">即将上线</span>
          </Button>

          <p className="text-center text-xs text-muted-foreground">更多登录方式即将上线</p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          继续即表示你同意我们的服务条款与隐私政策
        </p>
      </div>
    </main>
  );
}

// Separate async component to resolve searchParams
async function ErrorMessage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!error) return null;

  const messages: Record<string, string> = {
    OAuthSignin: "OAuth 登录初始化失败，请重试",
    OAuthCallback: "OAuth 回调处理失败，请重试",
    OAuthCreateAccount: "创建账户失败，请重试",
    Callback: "登录回调出错，请重试",
    Default: "登录失败，请重试",
  };

  return (
    <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-center text-sm text-destructive">
      {messages[error] ?? messages["Default"]}
    </div>
  );
}
