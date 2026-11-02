import { upstreamTransport } from "../src/lib/ilias/upstream-transport";
import { afterEach, expect, mock, test } from "bun:test";
import { FREIBURG } from "../src/lib/ilias/config";
import { searchDemo, searchRepository } from "../src/lib/ilias/search";
import type { Session } from "../src/lib/ilias/session";

const originalFetch = upstreamTransport.fetch;
afterEach(() => {
  upstreamTransport.fetch = originalFetch;
});

const dashboard = `<a href="logout.php">Logout</a>
  <form role="search" id="mm_search_form" action="ilias.php?baseClass=ilSearchControllerGUI&amp;cmdClass=ilSearchGUI&amp;cmd=remoteSearch&amp;rtoken=secret" method="post" target="_top">
    <input type="text" name="queryString" autocomplete="off">
    <input type="submit" value="Search">
    <fieldset>
      <input type="radio" name="root_id" value="1" checked="checked" id="ilmmsg">
      <label for="ilmmsg">Search globally</label>
      <input type="radio" name="root_id" value="12" id="ilmmsc">
      <label for="ilmmsc">Search at current position</label>
    </fieldset>
  </form>`;

const results = `<a href="logout.php">Logout</a><h1>Search results</h1>
  <div class="il-item il-std-item">
    <span class="il-item-title"><a href="goto.php?target=grp_601">Gruppe 02</a></span>
    <span class="il-item-property-name">Path</span><span class="il-item-property-value">Introduction to Computer Science › Exercise groups</span>
  </div>
  <div class="il-item il-std-item">
    <span class="il-item-title"><a href="goto.php?target=grp_602">Gruppe 02</a></span>
    <span class="il-item-property-name">Path</span><span class="il-item-property-value">Linear Algebra I › Exercise groups</span>
  </div>`;

function session(): Session {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    instance: FREIBURG,
    status: "pending",
    createdAt: Date.now(),
  };
}

test("demo search returns deep matches and distinguishes duplicate titles by path", () => {
  const groups = searchDemo("gruppe 02");
  expect(
    groups.results
      .filter((item) => item.title === "Gruppe 02")
      .map((item) => item.context),
  ).toEqual([
    "Introduction to Computer Science › Exercise groups",
    "Linear Algebra I › Exercise groups",
    "Human–Computer Interaction › Exercise groups",
  ]);
  const materials = searchDemo("lecture materials");
  expect(
    materials.results.filter((item) => item.title === "Lecture materials"),
  ).toHaveLength(4);
  expect(searchDemo("linear").results[0].title).toBe("Linear Algebra I");
});

test("repository search discovers the ILIAS form action and parses result paths", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  upstreamTransport.fetch = mock(
    async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return new Response(requests.length === 1 ? dashboard : results, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  ) as unknown as typeof fetch;
  const found = await searchRepository(session(), "Gruppe 02");
  expect(requests).toHaveLength(2);
  expect(requests[0].init?.method).toBe("GET");
  expect(requests[1].init?.method).toBe("POST");
  expect(requests[1].url).toContain("rtoken=secret");
  const body = new URLSearchParams(String(requests[1].init?.body));
  expect(body.get("queryString")).toBe("Gruppe 02");
  expect(body.get("root_id")).toBe("1");
  // ILIAS 10 carries the command in the form action, not in a hidden field.
  expect(body.has("cmd")).toBe(false);
  expect(
    found.results.map((item) => [item.id, item.type, item.context]),
  ).toEqual([
    [
      "601",
      "grp",
      "Introduction to Computer Science › Exercise groups",
    ],
    ["602", "grp", "Linear Algebra I › Exercise groups"],
  ]);
  expect(found.sourceUrl).toContain("cmd=remoteSearch");
});

test("repository search reports a missing ILIAS search form without posting", async () => {
  const request = mock(
    async () =>
      new Response('<a href="logout.php">Logout</a><h1>Dashboard</h1>', {
        headers: { "content-type": "text/html" },
      }),
  );
  upstreamTransport.fetch = request as unknown as typeof fetch;
  await expect(searchRepository(session(), "Gruppe 02")).rejects.toThrow(
    "repository search",
  );
  expect(request).toHaveBeenCalledTimes(1);
});
