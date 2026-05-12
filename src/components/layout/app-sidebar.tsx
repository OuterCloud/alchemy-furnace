"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, LayoutDashboard, Library, LogOut, Settings, Sparkles } from "lucide-react";
import { signOut } from "next-auth/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Skills", href: "/skills", icon: Sparkles },
  { title: "Sources", href: "/sources", icon: Library },
  { title: "Settings", href: "/settings", icon: Settings },
] as const;

interface AppSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  workspace: {
    name: string;
    slug: string;
  } | null;
}

export function AppSidebar({ user, workspace }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <FlaskConical className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">Alchemy Furnace</p>
            {workspace && (
              <p className="truncate text-xs text-muted-foreground">{workspace.name}</p>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname.startsWith(item.href)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-3 px-2 py-1">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
            <AvatarFallback>{user.name?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name ?? "Anonymous"}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email ?? ""}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">退出登录</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
