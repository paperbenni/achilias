import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CookieJar } from "tough-cookie";
import { fetchUpstream } from "../../src/lib/ilias/client";
import {
  saveSession,
  readSession,
  deleteSession,
  type Session,
} from "../../src/lib/ilias/session";
const session: Session = {
  id: randomUUID(),
  instance: "https://ilias.uni-freiburg.de/",
  createdAt: Date.now(),
  status: "connected",
  userName: "Account",
};
await saveSession(session);
let calls = 0;
let release!: () => void;
let started!: () => void;
const bothStarted = new Promise<void>((resolve) => {
  started = resolve;
});
const held = new Promise<void>((resolve) => {
  release = resolve;
});
globalThis.fetch = (async () => {
  const call = ++calls;
  if (call === 2) started();
  await held;
  return new Response("Content", {
    headers: { "set-cookie": `rotation${call}=value${call}; Secure; Path=/` },
  });
}) as unknown as typeof fetch;
const first = fetchUpstream({ ...session }, "ilias.php?one");
const second = fetchUpstream({ ...session }, "ilias.php?two");
await bothStarted;
release();
await Promise.all([first, second]);
const saved = (await readSession(session.id))!;
assert.equal(saved.userName, "Account");
const cookies = await CookieJar.fromJSON(saved.jar!).getCookieString(
  session.instance,
);
assert.ok(cookies.includes("rotation1=value1"));
assert.ok(cookies.includes("rotation2=value2"));

let releaseLate!: () => void;
let requestStarted!: () => void;
const lateStarted = new Promise<void>((resolve) => {
  requestStarted = resolve;
});
const late = new Promise<void>((resolve) => {
  releaseLate = resolve;
});
globalThis.fetch = (async () => {
  requestStarted();
  await late;
  return new Response("Content", {
    headers: { "set-cookie": "late=must-not-revive; Secure; Path=/" },
  });
}) as unknown as typeof fetch;
const pending = fetchUpstream(saved, "ilias.php?late");
await lateStarted;
await deleteSession(session.id);
releaseLate();
await pending;
assert.equal(await readSession(session.id), null);
console.log("verified");
