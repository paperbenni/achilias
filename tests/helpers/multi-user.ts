import { mock } from "bun:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { CookieJar } from "tough-cookie";
import { upstreamTransport } from "../../src/lib/ilias/upstream-transport";
const request = new AsyncLocalStorage<string>();
mock.module("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: request.getStore() }) }),
}));
mock.module("next/cache", () => ({
  revalidatePath: () => {
    throw new Error("Rejected actions must not invalidate another user's page");
  },
}));
const { saveSession, readSession, deleteSession } =
  await import("../../src/lib/ilias/session");
const { getWorkspace } = await import("../../src/lib/ilias/workspace");
const { requireWorkspaceConnection } =
  await import("../../src/lib/ilias/workspace-context");
const { POST: markThreadReadRoute } = await import(
  "../../src/app/api/forums/[forumId]/threads/[threadId]/read/route"
);
const instance = "https://ilias.uni-freiburg.de/";
const ids = [randomUUID(), randomUUID()];
for (const [index, id] of ids.entries()) {
  const jar = new CookieJar();
  await jar.setCookie(`PHPSESSID=user-${index}; Secure; Path=/`, instance);
  await saveSession({
    id,
    instance,
    jar: jar.serializeSync(),
    createdAt: Date.now(),
    status: "connected",
    userName: `User ${index}`,
  });
}
let calls = 0;
upstreamTransport.fetch = async (_input, init) => {
  calls++;
  const cookie = (init?.headers as Record<string, string>).Cookie;
  const index = cookie.includes("user-0") ? 0 : 1;
  assert.equal(cookie, `PHPSESSID=user-${index}`);
  // Force requests to interleave; no global cookie jar may be used.
  await new Promise((resolve) => setTimeout(resolve, index ? 2 : 10));
  return new Response(
    `<a href="logout.php">Logout</a><h1>Private course ${index}</h1>`,
    {
      headers: {
        "content-type": "text/html",
        "set-cookie": `rotation=only-${index}; Secure; Path=/`,
      },
    },
  );
};
const [a, b] = await Promise.all(
  ids.map((id) => request.run(id, () => getWorkspace())),
);
assert.equal(a.userName, "User 0");
assert.equal(b.userName, "User 1");
assert.equal(a.page.title, "Private course 0");
assert.equal(b.page.title, "Private course 1");
assert.notEqual(a.storageKey, b.storageKey);
assert.equal(calls, 2);
for (const [index, id] of ids.entries()) {
  const jar = CookieJar.fromJSON((await readSession(id))!.jar!);
  assert.match(
    await jar.getCookieString(instance),
    new RegExp(`rotation=only-${index}`),
  );
  assert.doesNotMatch(
    await jar.getCookieString(instance),
    new RegExp(`only-${1 - index}`),
  );
}
await request.run(ids[0], async () => {
  await assert.rejects(
    () => requireWorkspaceConnection(b.storageKey!),
    /connection changed/,
  );
  const rejected = await markThreadReadRoute(
    new Request("http://localhost:3000/api/forums/401/threads/601/read", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "x-achilias-connection": b.storageKey!,
      },
    }),
    { params: Promise.resolve({ forumId: "401", threadId: "601" }) },
  );
  assert.equal(rejected.status, 409);
  assert.match(
    ((await rejected.json()) as { error: string }).error,
    /connection changed/,
  );
});
assert.equal(calls, 2);
await deleteSession(ids[0]);
assert.equal(await readSession(ids[0]), null);
assert.equal((await request.run(ids[1], () => getWorkspace())).mode, "live");
await deleteSession(ids[1]);
console.log("verified");
