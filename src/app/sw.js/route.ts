import { randomUUID } from "node:crypto";
import { serviceWorkerSource } from "@/lib/pwa/service-worker";

// Generate a stable worker per production build, with a fresh public cache on
// every deployment. No account data or runtime filesystem reads are involved.
export const dynamic = "force-static";

export function GET() {
  return new Response(serviceWorkerSource(randomUUID()), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; connect-src 'self'",
    },
  });
}
