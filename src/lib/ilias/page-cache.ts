import type { IliasPage } from "./types";

/**
 * ILIAS page loads are the slowest part of a navigation. The browser router
 * already reuses a visited route for 30 seconds; this keeps the upstream
 * download and the HTML parse out of the next navigation, a second tab, or the
 * sibling dashboard route. Entries are per session and never shared.
 */
export const workspacePageTtl = 30_000;
const maxPages = 200;

export type CachedWorkspacePage = { page: IliasPage; fetchedAt: number };
type Entry = CachedWorkspacePage & { expiresAt: number };
const pages = new Map<string, Entry>();
const pending = new Map<string, Promise<CachedWorkspacePage>>();
const keyFor = (sessionId: string, url: string) => `${sessionId}\n${url}`;

function prune() {
  const now = Date.now();
  for (const [key, entry] of pages)
    if (entry.expiresAt <= now) pages.delete(key);
  while (pages.size > maxPages) {
    const oldest = pages.keys().next().value;
    if (oldest === undefined) break;
    pages.delete(oldest);
  }
}

/** Drop reuse for one account, or for every account after an explicit refresh. */
export function clearWorkspacePages(sessionId?: string) {
  if (sessionId === undefined) {
    pages.clear();
    pending.clear();
    return;
  }
  const prefix = `${sessionId}\n`;
  for (const key of pages.keys())
    if (key.startsWith(prefix)) pages.delete(key);
  for (const key of pending.keys())
    if (key.startsWith(prefix)) pending.delete(key);
}

export async function loadWorkspacePage(
  sessionId: string,
  url: string,
  load: () => Promise<IliasPage>,
): Promise<CachedWorkspacePage> {
  const key = keyFor(sessionId, url);
  const cached = pages.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    // Re-insert so the least recently used entry is evicted first.
    pages.delete(key);
    pages.set(key, cached);
    return { page: cached.page, fetchedAt: cached.fetchedAt };
  }
  pages.delete(key);
  const shared = pending.get(key);
  if (shared) return shared;
  // A synchronous throw and a rejected request must both stay uncached.
  const task = Promise.resolve()
    .then(load)
    .then((page) => {
      const fetchedAt = Date.now();
      pages.set(key, { page, fetchedAt, expiresAt: fetchedAt + workspacePageTtl });
      prune();
      return { page, fetchedAt };
    });
  pending.set(key, task);
  try {
    return await task;
  } finally {
    if (pending.get(key) === task) pending.delete(key);
  }
}
