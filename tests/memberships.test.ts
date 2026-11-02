import { afterEach, expect, mock, test } from "bun:test";
import { upstreamTransport } from "../src/lib/ilias/upstream-transport";
import { clearWorkspacePages } from "../src/lib/ilias/page-cache";
import { loadMemberships } from "../src/lib/ilias/memberships";
import type { Session } from "../src/lib/ilias/session";

const originalFetch = upstreamTransport.fetch;
afterEach(async () => {
  upstreamTransport.fetch = originalFetch;
  await clearWorkspacePages();
});
const session = (id: string): Session => ({
  id, instance: "https://campus.example/ilias/", status: "pending", createdAt: Date.now(),
});
const listing = (title: string) => `<a href="logout.php">Logout</a>
  <h1>My courses and groups</h1>
  <div class="il-item"><span class="il-item-title"><a href="goto.php?target=crs_101">${title}</a></span></div>
  <div class="il-item"><span class="il-item-title"><a href="goto.php?target=grp_102">Study group</a></span></div>`;

test("loads memberships rather than dashboard favorites and caches per account", async () => {
  const urls: string[] = [];
  upstreamTransport.fetch = mock(async (url: Parameters<typeof fetch>[0]) => {
    urls.push(String(url));
    return new Response(listing(urls.length === 1 ? "Unvisited course" : "Other account course"), {
      headers: { "content-type": "text/html" },
    });
  }) as unknown as typeof fetch;
  const first = await loadMemberships(session("a"));
  expect(first.items.map((item) => item.title)).toEqual(["Unvisited course", "Study group"]);
  expect(await loadMemberships(session("a"))).toEqual(first);
  expect((await loadMemberships(session("b"))).items[0].title).toBe("Other account course");
  expect(urls).toEqual(Array(2).fill("https://campus.example/ilias/ilias.php?baseClass=ilMembershipOverviewGUI"));
});

test("expired membership sessions fail without caching an empty course list", async () => {
  let calls = 0;
  upstreamTransport.fetch = mock(async () => {
    calls++;
    return new Response(calls === 1 ? "<h1>Login</h1>" : listing("Recovered course"), {
      headers: { "content-type": "text/html" },
    });
  }) as unknown as typeof fetch;
  await expect(loadMemberships(session("a"))).rejects.toThrow("expired");
  expect((await loadMemberships(session("a"))).items[0].title).toBe("Recovered course");
});
