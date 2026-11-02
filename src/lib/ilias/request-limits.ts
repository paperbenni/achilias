import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import { createHash } from "node:crypto";
import { isIP } from "node:net";

export class RequestLimitError extends Error {
  status = 429;
}
type Operation = "start" | "transfer" | "claim";
/** The global limit is consumed first, bounding the number of client keys as well. */
export function createSignInLimiter() {
  const limits = Object.fromEntries(
    (["start", "transfer", "claim"] as const).map((operation) => [
      operation,
      {
        global: new RateLimiterMemory({
          points: operation === "start" ? 200 : 1200,
          duration: 600,
        }),
        client: new RateLimiterMemory({
          points: operation === "start" ? 12 : 60,
          duration: 600,
        }),
      },
    ]),
  ) as Record<
    Operation,
    { global: RateLimiterMemory; client: RateLimiterMemory }
  >;
  return async (request: Request, operation: Operation) => {
    // Trust forwarding headers only behind a proxy that overwrites them.
    const remote =
      process.env.ACHILIAS_TRUST_PROXY === "true"
        ? (request.headers.get("x-forwarded-for") || "").split(",")[0].trim()
        : "";
    const ip = isIP(remote) ? remote : "unknown";
    const client = createHash("sha256").update(ip).digest("hex").slice(0, 24);
    try {
      await limits[operation].global.consume("all");
      await limits[operation].client.consume(client);
    } catch (error) {
      if (error instanceof RateLimiterRes)
        throw new RequestLimitError(
          "Too many sign-in attempts. Try again later.",
        );
      throw error;
    }
  };
}
const state = globalThis as typeof globalThis & {
  achiliasSignInLimiter?: ReturnType<typeof createSignInLimiter>;
};
export const limitSignIn = (state.achiliasSignInLimiter ||=
  createSignInLimiter());
/** Stop parallel cookie exports from filling all upstream connections. */
const verificationState = globalThis as typeof globalThis & {
  achiliasVerifications?: number;
};
export async function withVerificationLimit<T>(operation: () => Promise<T>) {
  if ((verificationState.achiliasVerifications || 0) >= 8)
    throw new RequestLimitError(
      "Sign-in verification is busy. Wait a moment and try again.",
    );
  verificationState.achiliasVerifications =
    (verificationState.achiliasVerifications || 0) + 1;
  try {
    return await operation();
  } finally {
    verificationState.achiliasVerifications!--;
  }
}
export async function readSmallJson(
  request: Request,
  limit = 4096,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("A JSON request body is required.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error("Request body is too large.");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
