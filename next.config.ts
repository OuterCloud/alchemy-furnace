import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse depends on pdfjs-dist whose worker path resolution breaks when
  // bundled by webpack/turbopack. Load it natively from node_modules instead.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
