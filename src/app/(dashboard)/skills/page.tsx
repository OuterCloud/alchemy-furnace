import type { Metadata } from "next";

export const metadata: Metadata = { title: "Skills" };

export default function SkillsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Skills</h1>
      <p className="text-muted-foreground">Manage your refined AI skills here.</p>
    </div>
  );
}
