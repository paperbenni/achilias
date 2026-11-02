import { expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceStore, discoveryTtl } from "../src/lib/ilias/workspace-store";
import { demoPage } from "../src/lib/ilias/demo";

test("encrypted listing memoization survives reopening, isolates logins, and expires independently of navigation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "achilias-cache-"));
  const file = join(dir, "cache.sqlite");
  const key = randomBytes(32);
  const url = "https://campus.example/goto.php?target=fold_404";
  const page = { ...demoPage(), title: "Private tutorate listing" };
  let store = new WorkspaceStore(file, key);
  try {
    const fetchedAt = Date.now() - 31_000;
    store.write("alice", { url, page, fetchedAt });
    expect(store.read("alice", url, 30_000)).toBeUndefined();
    expect(store.listings("alice")[0].page.title).toBe(page.title);
    expect(store.listings("bob")).toEqual([]);
    store.close();
    store = new WorkspaceStore(file, key);
    expect(store.listings("alice")[0].fetchedAt).toBe(fetchedAt);
    store.write("bob", { url, page, fetchedAt: Date.now() });
    store.clear("alice");
    expect(store.listings("alice")).toEqual([]);
    expect(store.listings("bob")).toHaveLength(1);
    store.write("old", { url, page, fetchedAt: Date.now() - discoveryTtl - 1 });
    expect(store.listings("old")).toEqual([]);
  } finally {
    store.close();
    const bytes = await readFile(file);
    expect(bytes.includes(Buffer.from(page.title))).toBe(false);
    expect(bytes.includes(Buffer.from(url))).toBe(false);
    await rm(dir, { recursive: true, force: true });
  }
});
