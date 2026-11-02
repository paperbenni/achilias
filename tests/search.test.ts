import { upstreamTransport } from "../src/lib/ilias/upstream-transport";
import { afterEach, expect, mock, test } from "bun:test";
import { FREIBURG } from "../src/lib/ilias/config";
import { searchDemo, searchRepository, clearSearchFormCache } from "../src/lib/ilias/search";
import type { Session } from "../src/lib/ilias/session";

const originalFetch = upstreamTransport.fetch;
afterEach(() => {
  upstreamTransport.fetch = originalFetch;
  clearSearchFormCache();
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

const pager = (next: number) =>
  `<div class="il-viewcontrol-pagination"><a href="ilias.php?baseClass=ilSearchControllerGUI&amp;cmdClass=ilSearchGUI&amp;cmd=switchResultPage&amp;sortation=relevance_desc&amp;rtoken=page-token&amp;page_number=${next}">Next</a></div>`;

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

test("repository search reuses the discovered form for later queries", async () => {
  const requests: { method?: string; body?: string }[] = [];
  upstreamTransport.fetch = mock(
    async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push({ method: init?.method, body: String(init?.body ?? "") });
      return new Response(requests.length === 1 ? dashboard : results, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  ) as unknown as typeof fetch;
  await searchRepository(session(), "Gruppe 02");
  await searchRepository(session(), "Linear");
  expect(requests.map((request) => request.method)).toEqual([
    "GET",
    "POST",
    "POST",
  ]);
  expect(new URLSearchParams(requests[2].body).get("queryString")).toBe(
    "Linear",
  );
});

test("repository search rediscovers once when ILIAS ignores a stale token", async () => {
  const toolbar = (term: string) =>
    `<input id="search_field" type="text" name="term" value="${term}">`;
  // A stale token makes ilCtrl fall back to the saved search, which echoes the
  // previous term instead of this query.
  const responses = [
    dashboard,
    results + toolbar("Old term"),
    dashboard,
    results + toolbar("Gruppe 02"),
  ];
  const requests: string[] = [];
  upstreamTransport.fetch = mock(
    async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push(`${init?.method} ${String(url)}`);
      return new Response(responses[requests.length - 1], {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  ) as unknown as typeof fetch;
  const found = await searchRepository(session(), "Gruppe 02");
  expect(requests.map((request) => request.split(" ")[0])).toEqual([
    "GET",
    "POST",
    "GET",
    "POST",
  ]);
  expect(found.results).toHaveLength(2);
});

test("repository search returns every parsed result instead of truncating", async () => {
  const many =
    `<a href="logout.php">Logout</a>` +
    Array.from(
      { length: 45 },
      (_, i) =>
        `<div class="il-item"><span class="il-item-title"><a href="goto.php?target=file_${700 + i}">File ${i}</a></span></div>`,
    ).join("");
  const requests: string[] = [];
  upstreamTransport.fetch = mock(
    async (url: Parameters<typeof fetch>[0]) => {
      requests.push(String(url));
      return new Response(requests.length === 1 ? dashboard : many, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  ) as unknown as typeof fetch;
  const found = await searchRepository(session(), "File");
  expect(found.results).toHaveLength(45);
});

test("repository search fetches the next ILIAS result page on demand", async () => {
  const next = `<a href="logout.php">Logout</a><h1>Search results</h1>
    <div class="il-item">
      <span class="il-item-title"><a href="goto.php?target=grp_603">Gruppe 02</a></span>
      <span class="il-item-property-name">Path</span><span class="il-item-property-value">Linear Algebra I › Exercise groups</span>
    </div>`;
  const requests: { url: string; method?: string }[] = [];
  upstreamTransport.fetch = mock(
    async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push({ url: String(url), method: init?.method });
      const body =
        requests.length === 1
          ? dashboard
          : requests.length === 2
            ? results + pager(1)
            : next;
      return new Response(body, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  ) as unknown as typeof fetch;
  const first = await searchRepository(session(), "Gruppe 02");
  expect(first.page).toBe(1);
  expect(first.hasMore).toBe(true);
  const second = await searchRepository(session(), "Gruppe 02", 2);
  expect(requests.map((request) => request.method)).toEqual([
    "GET",
    "POST",
    "GET",
  ]);
  const action = new URL(requests[2].url);
  expect(action.searchParams.get("cmd")).toBe("switchResultPage");
  expect(action.searchParams.get("page_number")).toBe("1");
  // The page link, not the form action, carries the token ILIAS issued for it.
  expect(action.searchParams.get("rtoken")).toBe("page-token");
  expect(second.page).toBe(2);
  expect(second.hasMore).toBe(false);
  expect(second.results.map((item) => item.id)).toEqual(["603"]);
  expect(second.sourceUrl).toContain("page_number=1");
});

test("repository search only offers another page when ILIAS rendered one", async () => {
  let requests = 0;
  upstreamTransport.fetch = mock(
    async () => {
      requests++;
      const body =
        requests === 1
          ? dashboard
          : // A link to a different command must never be followed.
            results +
            `<a href="ilias.php?baseClass=ilSearchControllerGUI&amp;cmdClass=ilSearchGUI&amp;cmd=deleteObject&amp;page_number=1">Next</a>`;
      return new Response(body, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  ) as unknown as typeof fetch;
  const found = await searchRepository(session(), "Gruppe 02");
  expect(found.hasMore).toBe(false);
  await expect(searchRepository(session(), "Gruppe 02", 2)).rejects.toThrow(
    "did not offer",
  );
  expect(requests).toBe(2);
});

test("repository search rejects a page that does not belong to a live search", async () => {
  const request = mock(
    async () =>
      new Response(dashboard, {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
  );
  upstreamTransport.fetch = request as unknown as typeof fetch;
  await expect(searchRepository(session(), "Gruppe 02", 2)).rejects.toThrow(
    "expired",
  );
  expect(request).not.toHaveBeenCalled();
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

test("scoped searches submit the container root and bind pagination to it", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  upstreamTransport.fetch = mock(async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return new Response(requests.length === 1 ? dashboard : results + pager(1), {
      headers: { "content-type": "text/html" },
    });
  }) as unknown as typeof fetch;
  const account = session();
  await searchRepository(account, "Gruppe", 1, "12");
  expect(new URLSearchParams(String(requests[1].init?.body)).get("root_id")).toBe("12");
  await expect(searchRepository(account, "Gruppe", 2)).rejects.toThrow("expired");
  await expect(searchRepository(account, "Gruppe", 2, "13")).rejects.toThrow("expired");
  expect(requests).toHaveLength(2);
  await searchRepository(account, "Gruppe", 2, "12");
  expect(requests[2].url).toContain("page_number=1");
});

test("concurrent searches are serialized because ILIAS shares search state", async () => {
  let release!: () => void;
  let started!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const searching = new Promise<void>((resolve) => { started = resolve; });
  const queries: string[] = [];
  upstreamTransport.fetch = mock(async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (init?.method !== "POST")
      return new Response(dashboard, { headers: { "content-type": "text/html" } });
    const query = new URLSearchParams(String(init.body)).get("queryString")!;
    queries.push(query);
    if (query === "First") { started(); await blocked; }
    return new Response(results, { headers: { "content-type": "text/html" } });
  }) as unknown as typeof fetch;
  const account = session();
  const first = searchRepository(account, "First", 1, "12");
  await searching;
  const second = searchRepository(account, "Second");
  await Promise.resolve();
  expect(queries).toEqual(["First"]);
  release();
  await Promise.all([first, second]);
  expect(queries).toEqual(["First", "Second"]);
});

test("demo scoped search includes descendants and excludes other courses", () => {
  const scoped = searchDemo("getting started", FREIBURG, "102");
  expect(scoped.results).toHaveLength(1);
  expect(scoped.results[0].context).toBe("Linear Algebra I › Lecture materials");
  expect(searchDemo("getting started").results).toHaveLength(4);
});

test("a stale token with the right term but wrong root is retried", async () => {
  const scope = (root: string) => `<script>il.Search.syncFilterScope('filter-id', '${root}');</script>`;
  const responses = [dashboard, results + scope("1"), dashboard, results + scope("12")];
  let calls = 0;
  upstreamTransport.fetch = mock(async () => new Response(responses[calls++], {
    headers: { "content-type": "text/html" },
  })) as unknown as typeof fetch;
  expect((await searchRepository(session(), "Gruppe", 1, "12")).results).toHaveLength(2);
  expect(calls).toBe(4);
});

test("cancelled queued searches never submit to ILIAS", async () => {
  const controller = new AbortController();
  controller.abort();
  const request = mock(async () => new Response(dashboard));
  upstreamTransport.fetch = request as unknown as typeof fetch;
  await expect(searchRepository(session(), "Gruppe", 1, undefined, controller.signal)).rejects.toThrow("cancelled");
  expect(request).not.toHaveBeenCalled();
});
