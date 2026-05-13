import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { CreateRoleForm } from "@/components/role/create-role-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "新建角色" };

export default function NewRolePage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button nativeButton={false} variant="ghost" size="icon-sm" render={<Link href="/roles" />}>
          <ChevronLeft />
          <span className="sr-only">返回</span>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">新建角色</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            先起个名字，之后在角色页面编写系统提示词并挂载知识库
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md">
        <CreateRoleForm />
      </div>
    </div>
  );
}
