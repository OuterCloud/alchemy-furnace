import Link from "next/link";
import { Bot } from "lucide-react";

import { StartConversationButton } from "@/components/chat/start-conversation-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface RoleCardProps {
  role: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: Date | string;
  };
  latestConversationId?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

export function RoleCard({ role, latestConversationId = null }: RoleCardProps) {
  return (
    <Card className="flex flex-col transition-all hover:ring-primary/30">
      <Link href={`/roles/${role.id}`} className="flex flex-1 cursor-pointer flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 shrink-0 text-primary" />
              <CardTitle>{role.name}</CardTitle>
            </div>
            <Badge variant={role.status === "PUBLISHED" ? "default" : "secondary"}>
              {STATUS_LABEL[role.status] ?? role.status}
            </Badge>
          </div>
        </CardHeader>
        {role.description && (
          <CardContent className="flex-1">
            <p className="line-clamp-2 text-sm text-muted-foreground">{role.description}</p>
          </CardContent>
        )}
      </Link>

      {role.status === "PUBLISHED" && (
        <CardFooter>
          <StartConversationButton roleId={role.id} latestConversationId={latestConversationId} />
        </CardFooter>
      )}
    </Card>
  );
}
