import { describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { serviceWorkerSource } from "../src/lib/pwa/service-worker";
import manifest from "../src/app/manifest";

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const fetched: Request[] = [];
  const precached: Request[] = [];
  const credentials: Array<RequestCredentials | undefined> = [];
  const deleted: string[] = [];
  let offline = false;
  let shellAvailable = true;
  let skipped = 0;
  let claimed = 0;
  const cache = {
    addAll: async (requests: Request[]) => { precached.push(...requests); },
    match: async (request: string | Request) => {
      const path = typeof request === "string" ? request : new URL(request.url).pathname;
      return path === "/offline.html" && shellAvailable ? new Response("public offline screen") : undefined;
    },
  };
  class WorkerRequest extends Request {
    constructor(input: string, init?: RequestInit) {
      super(new URL(input, "https://achilias.example"), init);
      credentials.push(init?.credentials);
    }
  }
  runInNewContext(serviceWorkerSource("test-build"), {
    Request: WorkerRequest, Response, URL,
    self: {
      location: { origin: "https://achilias.example" },
      addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
      clients: { claim: async () => { claimed++; } },
      skipWaiting: async () => { skipped++; },
    },
    caches: {
      open: async () => cache,
      keys: async () => ["achilias-shell-old", "achilias-shell-test-build", "another-app"],
      delete: async (name: string) => { deleted.push(name); },
    },
    fetch: async (request: Request) => {
      fetched.push(request);
      if (offline) throw new TypeError("Network unavailable");
      return new Response("private network response");
    },
  });
  async function lifecycle(name: string, data?: unknown) {
    const tasks: Promise<unknown>[] = [];
    listeners.get(name)!({ data, waitUntil: (task: Promise<unknown>) => tasks.push(task) });
    await Promise.all(tasks);
  }
  function request(url: string, mode = "navigate", method = "GET") {
    let result: Promise<Response> | undefined;
    // Request.mode is read-only; this event stub exercises the worker boundary.
    listeners.get("fetch")!({
      request: { url, mode, method },
      respondWith: (response: Promise<Response>) => { result = response; },
    });
    return result;
  }
  return { lifecycle, request, precached, credentials, deleted, fetched,
    goOffline: () => { offline = true; },
    evictShell: () => { shellAvailable = false; },
    skipped: () => skipped, claimed: () => claimed };
}

describe("PWA account boundaries", () => {
  test("only public offline assets are precached, without credentials", async () => {
    const app = worker();
    await app.lifecycle("install");
    expect(app.precached.map((request) => new URL(request.url).pathname)).toEqual([
      "/offline.html", "/offline.css", "/offline.js", "/icons/app-192.png",
      "/icons/app-512.png", "/icons/apple-touch-icon.png",
    ]);
    expect(app.credentials).toEqual(Array(6).fill("omit"));
    expect(app.skipped()).toBe(0);
  });

  test("private navigations use the network and offline failures get a public reconnect screen", async () => {
    const app = worker();
    const url = "https://achilias.example/forums/402/threads/901";
    expect(await (await app.request(url))!.text()).toBe("private network response");
    app.goOffline();
    expect(await (await app.request(url))!.text()).toBe("public offline screen");
    expect(app.precached).toEqual([]);
    expect(app.fetched).toHaveLength(2);
  });

  test("API requests, file downloads, RSC, mutations, and other origins are never intercepted", () => {
    const app = worker();
    for (const [url, mode, method] of [
      ["https://achilias.example/api/files/123?view=1", "navigate", "GET"],
      ["https://achilias.example/api/session", "cors", "GET"],
      ["https://achilias.example/courses?_rsc=123", "cors", "GET"],
      ["https://achilias.example/courses", "cors", "POST"],
      ["https://achilias.example/_next/static/chunk.js", "cors", "GET"],
      ["https://ilias.example/goto.php?target=file_123", "navigate", "GET"],
    ]) expect(app.request(url, mode, method)).toBeUndefined();
    expect(app.fetched).toEqual([]);
  });

  test("browser eviction of the offline cache still produces a clear navigation error", async () => {
    const app = worker();
    app.goOffline();
    app.evictShell();
    const response = await app.request("https://achilias.example/courses");
    expect(response?.status).toBe(503);
    expect(await response?.text()).toContain("Achilias is offline");
  });

  test("updates require a message and clean up only this app's old public caches", async () => {
    const app = worker();
    await app.lifecycle("activate");
    expect(app.deleted).toEqual(["achilias-shell-old"]);
    expect(app.claimed()).toBe(1);
    await app.lifecycle("message", { type: "UNRELATED" });
    expect(app.skipped()).toBe(0);
    await app.lifecycle("message", { type: "SKIP_WAITING" });
    expect(app.skipped()).toBe(1);
  });

  test("installation shortcuts stay inside the app and never include account data", () => {
    const app = manifest();
    expect(app.start_url).toBe("/");
    expect(app.display).toBe("standalone");
    expect(app.shortcuts?.map((shortcut) => shortcut.url)).toEqual(["/courses", "/saved"]);
    expect(app.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
  });
});
