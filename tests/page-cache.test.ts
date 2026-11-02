import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import {
  clearWorkspacePages,
  loadWorkspacePage,
  workspacePageTtl,
} from "../src/lib/ilias/page-cache";
import type { IliasPage } from "../src/lib/ilias/types";

const page = (title: string): IliasPage => ({
  title,
  description: "",
  items: [],
  tools: [],
  text: [],
  notices: [],
  sourceUrl: "https://campus.example/ilias.php",
  authenticated: true,
  userName: "",
  hasMore: false,
});

beforeEach(() => clearWorkspacePages());
afterEach(() => {
  clearWorkspacePages();
  setSystemTime(new Date());
});

test("a page is loaded once per session and URL within its lifetime", async () => {
  let loads = 0;
  const load = async () => {
    loads++;
    return page("Dashboard");
  };
  const first = await loadWorkspacePage("session-a", "https://campus.example/ilias.php", load);
  const second = await loadWorkspacePage(
    "session-a",
    "https://campus.example/ilias.php",
    load,
  );
  expect(loads).toBe(1);
  expect(second).toEqual(first);
  await loadWorkspacePage("session-a", "https://campus.example/goto.php?target=crs_1", load);
  await loadWorkspacePage("session-b", "https://campus.example/ilias.php", load);
  expect(loads).toBe(3);
});

test("an expired page is fetched again", async () => {
  let loads = 0;
  const load = async () => {
    loads++;
    return page(`Dashboard ${loads}`);
  };
  await loadWorkspacePage("session-a", "url", load);
  setSystemTime(new Date(Date.now() + workspacePageTtl + 1));
  const refreshed = await loadWorkspacePage("session-a", "url", load);
  expect(loads).toBe(2);
  expect(refreshed.page.title).toBe("Dashboard 2");
});

test("concurrent requests for one page share a single upstream load", async () => {
  let loads = 0;
  let resolve!: (value: IliasPage) => void;
  const load = () => {
    loads++;
    return new Promise<IliasPage>((done) => {
      resolve = done;
    });
  };
  const first = loadWorkspacePage("session-a", "url", load);
  const second = loadWorkspacePage("session-a", "url", load);
  // The shared load starts on the next microtask, not in the first call.
  await Promise.resolve();
  expect(loads).toBe(1);
  resolve(page("Dashboard"));
  expect(await first).toEqual(await second);
});

test("a failed load is not reused", async () => {
  let loads = 0;
  const failing = async () => {
    loads++;
    throw new Error("ILIAS down");
  };
  await expect(loadWorkspacePage("session-a", "url", failing)).rejects.toThrow(
    "ILIAS down",
  );
  const good = async () => {
    loads++;
    return page("Recovered");
  };
  expect(
    (await loadWorkspacePage("session-a", "url", good)).page.title,
  ).toBe("Recovered");
  expect(loads).toBe(2);
});

test("invalidation clears one session or every session", async () => {
  let loads = 0;
  const load = async () => {
    loads++;
    return page("Dashboard");
  };
  await loadWorkspacePage("session-a", "url", load);
  await loadWorkspacePage("session-b", "url", load);
  clearWorkspacePages("session-a");
  await loadWorkspacePage("session-b", "url", load);
  expect(loads).toBe(2);
  clearWorkspacePages();
  await loadWorkspacePage("session-b", "url", load);
  expect(loads).toBe(3);
});
