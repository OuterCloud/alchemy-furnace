import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-muted-foreground">Manage your workspace and account settings.</p>
    </div>
  );
}
