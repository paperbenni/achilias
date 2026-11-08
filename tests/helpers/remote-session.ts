import { upstreamTransport } from "../../src/lib/ilias/upstream-transport";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CookieJar } from "tough-cookie";
import {
  saveSession,
  readSession,
  deleteSession,
  type Session,
} from "../../src/lib/ilias/session";
import {
  prepareRemoteLogin,
  remoteSession,
  completeRemoteLogin,
} from "../../src/lib/ilias/remote-login";
const instance = "https://ilias.uni-freiburg.de/";
const cookies = [
  {
    name: "PHPSESSID",
    value: "ilias-session-example",
    domain: "ilias.uni-freiburg.de",
    path: "/",
    secure: true,
    httpOnly: true,
  },
  {
    name: "idp-secret",
    value: "must-not-transfer",
    domain: "mylogin.uni-freiburg.de",
    path: "/",
    secure: true,
  },
];
const dashboard = () =>
  new Response('<a href="logout.php">Logout</a><h1>Dashboard</h1><footer>powered by ILIAS (v11.0)</footer>', {
    headers: { "content-type": "text/html" },
  });
let upstreamCookie = "";
upstreamTransport.fetch = (async (
  _input: Parameters<typeof fetch>[0],
  init?: RequestInit,
) => {
  upstreamCookie = (init?.headers as Record<string, string>).Cookie;
  return dashboard();
}) as unknown as typeof fetch;
async function pending(ageMs = 0) {
  const session: Session = {
    id: randomUUID(),
    instance,
    status: "pending",
    createdAt: Date.now(),
  };
  await saveSession(session);
  const pairing = await prepareRemoteLogin(session);
  if (ageMs) {
    const current = await readSession(session.id);
    current!.createdAt -= ageMs;
    await saveSession(current!);
  }
  return { session, ...pairing };
}
const first = await pending(7 * 60_000);
assert.equal(
  (await remoteSession(first.code)).id,
  first.session.id,
  "Remote codes must outlive the local browser timeout",
);
await assert.rejects(() => remoteSession(first.code + "x"));
await completeRemoteLogin(first.code, cookies);
const connected = await readSession(first.session.id);
assert.equal(connected?.status, "connected");
assert.equal(connected?.iliasVersion, "11.0");
assert.equal(connected?.remotePairing, undefined);
assert.ok(upstreamCookie.includes("PHPSESSID=ilias-session-example"));
assert.ok(!upstreamCookie.includes("idp-secret"));
assert.ok(!JSON.stringify(connected).includes("must-not-transfer"));
assert.ok(
  (
    await CookieJar.fromJSON(connected!.jar!).getCookieString(instance)
  ).includes("PHPSESSID="),
);
await assert.rejects(() => completeRemoteLogin(first.code, cookies));

const invalid = await pending();
upstreamTransport.fetch = (async () =>
  new Response('<form action="shib_login.php"></form>', {
    headers: { "content-type": "text/html" },
  })) as unknown as typeof fetch;
await assert.rejects(
  () => completeRemoteLogin(invalid.code, cookies),
  (error: unknown) => (error as { status: number }).status === 422,
);
assert.equal((await readSession(invalid.session.id))?.status, "pending");
assert.equal(
  (await readSession(invalid.session.id))?.jar,
  undefined,
  "Unverified cookies must not be persisted",
);

const cancelled = await pending();
let release!: () => void;
let started!: () => void;
const gate = new Promise<void>((resolve) => {
  release = resolve;
});
const fetching = new Promise<void>((resolve) => {
  started = resolve;
});
upstreamTransport.fetch = (async () => {
  started();
  await gate;
  return dashboard();
}) as unknown as typeof fetch;
const transfer = completeRemoteLogin(cancelled.code, cookies);
await fetching;
await assert.rejects(
  () => completeRemoteLogin(cancelled.code, cookies),
  (error: unknown) => (error as { status: number }).status === 409,
);
await deleteSession(cancelled.session.id);
release();
await assert.rejects(() => transfer);
assert.equal(
  await readSession(cancelled.session.id),
  null,
  "Cancelled upload resurrected its session",
);

const renewed = await pending();
const replacement = await prepareRemoteLogin(renewed.session);
await assert.rejects(() => remoteSession(renewed.code));
assert.equal((await remoteSession(replacement.code)).id, renewed.session.id);
const expires = await readSession(renewed.session.id);
expires!.remotePairing!.expiresAt = Date.now() - 1;
await saveSession(expires!);
await assert.rejects(() => remoteSession(replacement.code));
assert.equal((await readSession(renewed.session.id))?.status, "failed");
console.log("verified");
