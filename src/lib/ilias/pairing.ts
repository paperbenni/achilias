import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export function newPairing() {
  const secret = randomBytes(32).toString("base64url");
  return {
    secret,
    digest: createHash("sha256").update(secret).digest("hex"),
    expiresAt: Date.now() + 5 * 60_000,
  };
}
export function verifyPairing(
  secret: string,
  digest: string,
  expiresAt: number,
) {
  if (Date.now() > expiresAt || !/^[a-f0-9]{64}$/.test(digest)) return false;
  return timingSafeEqual(
    createHash("sha256").update(secret).digest(),
    Buffer.from(digest, "hex"),
  );
}

/** Shared wire format for single-use links and remote helper codes. */
export function parsePairingCode(code: unknown) {
  if (
    typeof code !== "string" ||
    !/^[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/.test(code)
  )
    return null;
  const [id, secret] = code.split(".");
  return { id, secret };
}
