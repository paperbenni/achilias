import { upstreamTransport } from "../../src/lib/ilias/upstream-transport";
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const id = randomUUID();
mock.module("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: id }) }),
}));
const { saveSession } = await import("../../src/lib/ilias/session");
await saveSession({
  id,
  instance: "https://ilias.uni-freiburg.de/",
  status: "connected",
  createdAt: Date.now(),
  userName: "Metadata example account",
});
let requests = 0;
upstreamTransport.fetch = (async () => {
  requests++;
  throw new Error("Settings and Saved must not fetch ILIAS");
}) as unknown as typeof fetch;
const { getWorkspaceMetadata } = await import("../../src/lib/ilias/workspace");
const first = await getWorkspaceMetadata(false);
const next = await getWorkspaceMetadata(false);
assert.equal(first.mode, "live");
assert.equal(first.userName, "Metadata example account");
assert.equal(requests, 0);
assert.equal(next.storageKey, first.storageKey);
assert.equal(first.page.items.length, 0);
const { getForumState } = await import("../../src/lib/ilias/forum");
const forum = await getForumState("402");
assert.equal(forum.workspace.storageKey, first.storageKey);
assert.equal(forum.workspace.mode, first.mode);
assert.equal(forum.workspace.userName, first.userName);
// The upstream error is contained in the feature state without discarding account metadata.
assert.equal(forum.forum, null);
assert.ok(forum.workspace.error);
const { getWorkspaceContext } =
  await import("../../src/lib/ilias/workspace-context");
await saveSession({
  id,
  instance: "https://ilias.uni-freiburg.de/",
  status: "connected",
  createdAt: Date.now(),
  userName: "Profilbild",
});
assert.equal(
  (await getWorkspaceMetadata()).userName,
  "",
  "Legacy avatar labels leaked into account display names",
);
const demo = await getWorkspaceContext(true);
assert.equal(demo.session, null);
assert.equal(demo.workspace.mode, "demo");
assert.equal(demo.workspace.storageKey, undefined);
console.log("verified");
