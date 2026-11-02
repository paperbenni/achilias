import { createHash } from "node:crypto";
import { isIP } from "node:net";

export class RequestLimitError extends Error {
  status = 429;
}
type Bucket = { count: number; until: number };
const state = globalThis as typeof globalThis & {
  achiliasRequestLimits?: Map<string, Bucket>;
};
const buckets = (state.achiliasRequestLimits ||= new Map<string, Bucket>());
export function takeRequestLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  // Expire unrelated buckets too, so forged client addresses cannot grow memory forever.
  for (const [key, bucket] of buckets)
    if (bucket.until <= now) buckets.delete(key);
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= 4096)
      throw new RequestLimitError(
        "Too many sign-in attempts. Try again later.",
      );
    bucket = { count: 0, until: now + windowMs };
    buckets.set(key, bucket);
  }
  if (++bucket.count > limit)
    throw new RequestLimitError("Too many sign-in attempts. Try again later.");
}
/** Trust forwarding headers only behind a proxy that overwrites them. */
export function limitSignIn(
  request: Request,
  operation: "start" | "transfer" | "claim",
) {
  const remote =
    process.env.ACHILIAS_TRUST_PROXY === "true"
      ? (request.headers.get("x-forwarded-for") || "").split(",")[0].trim()
      : "";
  const ip = isIP(remote) ? remote : "unknown";
  const client = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  const window = 10 * 60_000;
  const limit = operation === "start" ? 12 : 60;
  takeRequestLimit(
    `${operation}:all`,
    operation === "start" ? 200 : 1200,
    window,
  );
  takeRequestLimit(`${operation}:${client}`, limit, window);
}
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
