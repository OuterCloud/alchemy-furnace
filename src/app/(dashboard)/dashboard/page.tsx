import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome to Alchemy Furnace. Start by uploading source materials to refine into skills.
      </p>
    </div>
  );
}
