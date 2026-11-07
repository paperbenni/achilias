import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: process.env.ACHILIAS_STANDALONE === "true" ? "standalone" : undefined,
  // Keep sanitize-html and its PostCSS dependency together for standalone tracing.
  serverExternalPackages: ["sanitize-html"],
  // Reuse visited pages briefly in this browser. No shared server data cache.
  experimental: { staleTimes: { dynamic: 30, static: 30 } },
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};
export default nextConfig;
