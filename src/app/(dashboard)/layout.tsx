import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch user's first (personal) workspace
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} workspace={membership?.workspace ?? null} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
