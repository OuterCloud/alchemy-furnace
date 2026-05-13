import type { Metadata } from "next";

import { ThemeToggle } from "@/components/settings/theme-toggle";

export const metadata: Metadata = { title: "设置" };

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理你的账号与工作区</p>
      </div>

      {/* 外观 */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">外观</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">调整界面的显示主题</p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <p className="text-sm font-medium">主题</p>
          <ThemeToggle />
        </div>
      </section>
    </div>
  );
}
