import { afterEach, expect, test } from "bun:test";
import { loadWorkspacePage, clearWorkspacePages } from "../src/lib/ilias/page-cache";
import { indexedSearchItems, nearbySearchRoots } from "../src/lib/ilias/search-index";
import { discoverNearby } from "../src/lib/ilias/nearby-search";
import { upstreamTransport } from "../src/lib/ilias/upstream-transport";
import { readSearchStream } from "../src/lib/ilias/search-stream";
import type { IliasPage, Item } from "../src/lib/ilias/types";
import type { Session } from "../src/lib/ilias/session";

const instance = "https://campus.example/";
const session: Session = { id: "nearby-user", instance, status: "pending", createdAt: Date.now() };
const original = upstreamTransport.fetch;
afterEach(async () => { upstreamTransport.fetch = original; await clearWorkspacePages(); });
const item = (id: string, title: string, type = "fold"): Item => ({ id, title, type, sourceUrl: `${instance}goto.php?target=${type}_${id}`, available: true, description: "", meta: "" });
const page = (title: string, items: Item[]): IliasPage => ({ title, items, authenticated: true, description: "", tools: [], text: [], notices: [], sourceUrl: instance, userName: "", hasMore: false });
const seed = (id: string, title: string, items: Item[], type = "fold") => loadWorkspacePage(session.id, `${instance}goto.php?target=${type}_${id}`, async () => page(title, items));

test("visiting a folder makes unopened siblings searchable and prioritizes their shared parent", async () => {
  await seed("100", "Vorlesung", [item("200", "Tutorate")], "crs");
  await seed("200", "Tutorate", [item("302", "Gruppe 02"), item("304", "Gruppe 04")]);
  await seed("302", "Gruppe 02", [item("402", "Abgaben", "exc")]);
  expect((await indexedSearchItems(session.id)).find((entry) => entry.title === "Gruppe 04")?.context).toBe("Vorlesung › Tutorate");
  expect((await indexedSearchItems("other-user"))).toEqual([]);
  expect((await nearbySearchRoots(session.id, ["fold:302"]))[0].id).toBe("200");
});

test("discovery publishes a fast nested match before another course finishes and coalesces concurrent folder loads", async () => {
  await seed("100", "Vorlesung", [item("200", "Tutorate"), item("900", "Slow course", "crs")], "crs");
  let releaseSlow!: () => void;
  const slow = new Promise<void>((resolve) => { releaseSlow = resolve; });
  let found!: () => void;
  const match = new Promise<void>((resolve) => { found = resolve; });
  let slowStarted = false;
  const calls: string[] = [];
  upstreamTransport.fetch = (async (url: URL | RequestInfo) => {
    const target = new URL(String(url)).searchParams.get("target")!;
    calls.push(target);
    if (target === "crs_900") { slowStarted = true; await slow; }
    return new Response(`<a href="logout.php">Logout</a><h1>Tutorate</h1>${target === "fold_200" ? '<div class="il-item"><span class="il-item-title"><a href="goto.php?target=fold_304">Gruppe 04</a></span></div>' : ''}`, { headers: { "content-type": "text/html" } });
  }) as typeof fetch;
  const controller = new AbortController();
  const run = discoverNearby(session, ["crs:100"], controller.signal, (items) => {
    if (items.some((entry) => entry.title === "Gruppe 04")) found();
  });
  try {
    await match;
    expect(slowStarted).toBe(true);
    expect(calls.filter((target) => target === "fold_200")).toHaveLength(1);
  } finally { controller.abort(); releaseSlow(); await run; }
});

test("streaming handles arbitrary UTF-8 boundaries and publishes before EOF", async () => {
  let output!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { output = controller; } });
  const updates: Item[][] = [];
  let observed!: () => void;
  const update = new Promise<void>((resolve) => { observed = resolve; });
  const reading = readSearchStream(new Response(stream), new AbortController().signal, (items) => { updates.push(items); observed(); });
  const bytes = new TextEncoder().encode(JSON.stringify({ items: [item("404", "Übung Gruppe 04")] }) + "\n");
  for (const byte of bytes) output.enqueue(Uint8Array.of(byte));
  await update;
  expect(updates[0][0].title).toBe("Übung Gruppe 04");
  output.close();
  await reading;
});
