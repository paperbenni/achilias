import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import type { SerializedCookieJar } from "tough-cookie";
import { parsePairingCode, verifyPairing } from "./pairing";

export const SESSION_COOKIE = "achilias_session";
const dir = path.resolve(
  /* turbopackIgnore: true */ process.env.ACHILIAS_DATA_DIR || ".local",
);
const maxAge = 60 * 60 * 12;
export type Session = {
  id: string;
  instance: string;
  createdAt: number;
  status: "pending" | "connected" | "failed";
  pairing?: { digest: string; expiresAt: number };
  remotePairing?: { digest: string; expiresAt: number };
  jar?: SerializedCookieJar;
  error?: string;
  userName?: string;
};
let keyPromise: Promise<Buffer> | undefined;
async function getKey() {
  return (keyPromise ||= (async () => {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const file = path.join(dir, "session.key");
    try {
      return await readFile(file);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const key = randomBytes(32);
    try {
      await writeFile(file, key, { flag: "wx", mode: 0o600 });
      return key;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") return readFile(file);
      throw e;
    }
  })());
}
function sessionPath(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid session.");
  return path.join(dir, `${id}.enc`);
}
export async function saveSession(session: Session) {
  const key = await getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(session)),
    cipher.final(),
  ]);
  const file = sessionPath(session.id);
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, Buffer.concat([iv, cipher.getAuthTag(), data]), {
    mode: 0o600,
  });
  await rename(tmp, file);
}
export async function readSession(id?: string): Promise<Session | null> {
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) return null;
  let raw: Buffer;
  try {
    raw = await readFile(sessionPath(id));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    await getKey(),
    raw.subarray(0, 12),
  );
  decipher.setAuthTag(raw.subarray(12, 28));
  let session: Session;
  try {
    session = JSON.parse(
      Buffer.concat([
        decipher.update(raw.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
  } catch {
    return null;
  }
  if (session.createdAt + maxAge * 1000 < Date.now()) {
    await unlink(sessionPath(id)).catch(() => {});
    return null;
  }
  if (
    session.status === "pending" &&
    Date.now() >
      (session.remotePairing?.expiresAt || session.createdAt + 6 * 60_000)
  ) {
    session.status = "failed";
    session.error = "Sign-in expired. Start a new connection to try again.";
    await saveSession(session);
  }
  return session;
}
export async function currentSession() {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}
const lockState = globalThis as typeof globalThis & {
  achiliasSessionLocks?: Map<string, Promise<void>>;
};
const locks = (lockState.achiliasSessionLocks ||= new Map());
export async function withSessionLock<T>(
  id: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(id) || Promise.resolve();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => held);
  locks.set(id, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(id) === tail) locks.delete(id);
  }
}
export async function deleteSession(id: string) {
  await withSessionLock(id, async () => {
    await unlink(sessionPath(id)).catch(() => {});
  });
}
export async function setSessionCookie(id: string) {
  (await cookies()).set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.ACHILIAS_SECURE_COOKIE === "true",
    path: "/",
    maxAge,
  });
}
export async function createSession(instance: string) {
  const session: Session = {
    id: randomUUID(),
    instance,
    status: "pending",
    createdAt: Date.now(),
  };
  await saveSession(session);
  await setSessionCookie(session.id);
  return session;
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new Error("Request origin is not allowed.");
  const configured = process.env.ACHILIAS_ORIGIN;
  const originUrl = new URL(origin);
  // Next can normalize request.url to localhost even when the browser uses
  // 127.0.0.1. The Host header reflects that browser-visible local origin.
  const expected =
    configured ||
    `${new URL(request.url).protocol}//${request.headers.get("host") || new URL(request.url).host}`;
  if (
    !configured &&
    !["localhost", "127.0.0.1", "[::1]"].includes(originUrl.hostname)
  ) {
    throw new Error(
      "Set ACHILIAS_ORIGIN to the browser-visible origin for remote use.",
    );
  }
  if (
    origin !== expected ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new Error("Request origin is not allowed.");
  }
}

export const invalidClaimMessage =
  "This connection link is invalid, already used, or expired. Run the connection command again.";

/** Claim under the same per-session lock used by cancellation and remote sign-in. */
export async function claimSession(token: unknown) {
  const parsed = parsePairingCode(token);
  if (!parsed) throw new Error(invalidClaimMessage);
  return withSessionLock(parsed.id, async () => {
    const session = await readSession(parsed.id);
    if (
      !session?.pairing ||
      session.status !== "connected" ||
      !verifyPairing(
        parsed.secret,
        session.pairing.digest,
        session.pairing.expiresAt,
      )
    )
      throw new Error(invalidClaimMessage);
    delete session.pairing;
    await saveSession(session);
    return session.id;
  });
}
