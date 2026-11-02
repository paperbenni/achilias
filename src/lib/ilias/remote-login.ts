import { dashboardUrl } from "./config";
import {
  readSession,
  saveSession,
  withSessionLock,
  type Session,
} from "./session";
import { newPairing, parsePairingCode, verifyPairing } from "./pairing";
import { importInstanceCookies } from "./cookie-import";
import { fetchPage } from "./client";
export const remoteLifetime = 10 * 60_000;
export async function prepareRemoteLogin(session: Session) {
  return withSessionLock(session.id, async () => {
    const current = await readSession(session.id);
    if (!current || current.status !== "pending")
      throw new RemoteLoginError(
        "This connection is no longer waiting for sign-in.",
        409,
      );
    const pairing = newPairing();
    current.remotePairing = {
      digest: pairing.digest,
      expiresAt: Date.now() + remoteLifetime,
    };
    await saveSession(current);
    return {
      code: `${current.id}.${pairing.secret}`,
      expiresAt: current.remotePairing.expiresAt,
    };
  });
}
export class RemoteLoginError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function remoteSession(code: string) {
  const parsed = parsePairingCode(code);
  if (!parsed)
    throw new RemoteLoginError(
      "The connection code is invalid or expired.",
      401,
    );
  const { id, secret } = parsed;
  const session = await readSession(id);
  if (
    !session ||
    session.status !== "pending" ||
    !session.remotePairing ||
    !verifyPairing(
      secret,
      session.remotePairing.digest,
      session.remotePairing.expiresAt,
    )
  )
    throw new RemoteLoginError(
      "The connection code is invalid, expired, cancelled, or already used.",
      401,
    );
  return session;
}
const globalTransfers = globalThis as typeof globalThis & {
  achiliasTransfers?: Set<string>;
};
const transfers = (globalTransfers.achiliasTransfers ||= new Set());
export async function completeRemoteLogin(code: string, data: unknown) {
  const session = await remoteSession(code);
  if (transfers.has(session.id))
    throw new RemoteLoginError(
      "This connection is already being verified. Wait a moment and try again.",
      409,
    );
  transfers.add(session.id);
  try {
    const jar = await importInstanceCookies(data, session.instance);
    // Validate from this server's network; never trust a helper's claim of success.
    const candidate: Session = { ...session, jar, status: "pending" };
    let page;
    try {
      page = await fetchPage(candidate, dashboardUrl(session.instance));
    } catch {
      throw new RemoteLoginError(
        "The server could not verify this ILIAS session. It may have expired or be tied to your login IP. Try the helper through an SSH SOCKS proxy to this server, then sign in again.",
        422,
      );
    }
    // Cancellation/expiry during the upstream request must not resurrect a session.
    await withSessionLock(session.id, async () => {
      const current = await remoteSession(code);
      current.jar = candidate.jar;
      current.userName = page.userName;
      current.status = "connected";
      delete current.remotePairing;
      await saveSession(current);
    });
  } finally {
    transfers.delete(session.id);
  }
}
export async function readRemotePayload(request: Request) {
  const limit = 256 * 1024;
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new RemoteLoginError("Cookie export is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RemoteLoginError("Cookie export is required.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new RemoteLoginError("Cookie export is too large.", 413);
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RemoteLoginError("Cookie export is not valid JSON.");
  }
}
