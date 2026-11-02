import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  readFile,
  writeFile,
  rename,
  unlink,
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { dataDirectory, getStorageKey } from "./private-storage";
import { clearWorkspacePages } from "./page-cache";
import { cookies } from "next/headers";
import type { SerializedCookieJar } from "tough-cookie";
import { parsePairingCode, verifyPairing } from "./pairing";
import { isLoopbackHostname } from "./loopback";

export const SESSION_COOKIE = "achilias_session";
const dir = dataDirectory;
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
function sessionPath(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid session.");
  return path.join(dir, `${id}.enc`);
}
export async function saveSession(session: Session) {
  const key = await getStorageKey();
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
  if (raw.length < 28) return null;
  let session: Session;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      await getStorageKey(),
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    session = JSON.parse(
      Buffer.concat([
        decipher.update(raw.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
  } catch {
    return null;
  }
  if (session.id !== id || !Number.isFinite(session.createdAt)) return null;
  if (session.createdAt + maxAge * 1000 < Date.now()) {
    await unlink(sessionPath(id)).catch(() => {});
    await clearWorkspacePages(id);
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
    await clearWorkspacePages(id);
  });
}
export async function setSessionCookie(id: string) {
  (await cookies()).set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.ACHILIAS_SECURE_COOKIE === "true" ||
      process.env.ACHILIAS_ORIGIN?.startsWith("https://") === true,
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
  await maintainSessions();
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
    !isLoopbackHostname(originUrl.hostname)
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

let maintenance: Promise<void> | undefined;
let nextMaintenance = 0;
/** Single-process store: bound abandoned encrypted files without a background worker. */
async function maintainSessions() {
  if (maintenance) return maintenance;
  if (Date.now() < nextMaintenance) return;
  maintenance = (async () => {
    const files = (
      await readdir(dir).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      })
    ).filter((file) => /^[a-f0-9-]{36}\.enc$/.test(file));
    let retained = 0;
    for (const file of files) {
      const target = path.join(dir, file);
      const info = await stat(target).catch(() => null);
      if (info && info.mtimeMs < Date.now() - maxAge * 1000)
        await unlink(target).catch(() => {});
      else retained++;
    }
    if (retained >= 10_000)
      throw new Error(
        "This server has reached its session capacity. Try again later.",
      );
    nextMaintenance = Date.now() + 5 * 60_000;
  })();
  try {
    await maintenance;
  } finally {
    maintenance = undefined;
  }
}
