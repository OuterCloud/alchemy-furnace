/**
 * Worker entry point — runs all BullMQ workers in a single process.
 * Start with: pnpm worker
 */
import "./embed.worker";
import "./refine.worker";

process.on("SIGTERM", () => {
  console.warn("[Workers] SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.warn("[Workers] SIGINT received, shutting down gracefully...");
  process.exit(0);
});
