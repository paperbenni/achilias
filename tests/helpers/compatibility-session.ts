import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { upstreamTransport } from "../../src/lib/ilias/upstream-transport";
import { fetchPage } from "../../src/lib/ilias/client";
import { saveSession, readSession, deleteSession, type Session } from "../../src/lib/ilias/session";

const session: Session = {
  id: randomUUID(), instance: "https://ilias.example.edu/", status: "connected",
  createdAt: Date.now(), userName: "Example",
};
await saveSession(session);
let version = "10.6";
let requests = 0;
const html = () => new Response(
  `<a href="logout.php">Logout</a>${version ? `<footer>powered by ILIAS (v${version})</footer>` : ""}`,
  { headers: { "content-type": "text/html", "set-cookie": "rotation=retained; Secure; Path=/" } },
);
upstreamTransport.fetch = (async () => { requests++; return html(); }) as unknown as typeof fetch;
const page = await fetchPage(session, "ilias.php");
assert.equal(page.iliasVersion, "10.6");
assert.equal(requests, 1);
let saved = (await readSession(session.id))!;
assert.equal(saved.iliasVersion, "10.6");
assert.equal(saved.userName, "Example");
assert.ok(JSON.stringify(saved.jar).includes("rotation"));
version = "";
await fetchPage(session, "ilias.php");
assert.equal((await readSession(session.id))!.iliasVersion, "10.6");
version = "11.0";
await fetchPage(session, "ilias.php");
saved = (await readSession(session.id))!;
assert.equal(saved.iliasVersion, "11.0");

let release!: () => void;
let started!: () => void;
const held = new Promise<void>(resolve => { release = resolve; });
const began = new Promise<void>(resolve => { started = resolve; });
upstreamTransport.fetch = (async () => { started(); await held; return html(); }) as unknown as typeof fetch;
version = "12.0";
const inFlight = fetchPage(saved, "ilias.php");
await began;
await deleteSession(session.id);
release();
await inFlight;
assert.equal(await readSession(session.id), null);
console.log("verified");
