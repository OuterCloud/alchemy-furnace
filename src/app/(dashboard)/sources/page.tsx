import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sources" };

export default function SourcesPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Sources</h1>
      <p className="text-muted-foreground">
        Upload documents, URLs, or text to refine into skills.
      </p>
    </div>
  );
}
