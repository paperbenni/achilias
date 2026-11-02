import { workspaceStore, existingWorkspaceStore } from "./workspace-store";
import type { IliasPage } from "./types";

// Responses are reused briefly for navigation; search can discover their items
// for longer without presenting old activity data as a fresh page.
export const workspacePageTtl = 30_000;
export type CachedWorkspacePage = { page: IliasPage; fetchedAt: number };
const pending = new Map<string, Promise<CachedWorkspacePage>>();
const keyFor = (sessionId: string, url: string) => `${sessionId}\n${url}`;

export async function clearWorkspacePages(sessionId?: string) {
  for (const key of pending.keys())
    if (sessionId === undefined || key.startsWith(`${sessionId}\n`)) pending.delete(key);
  (await existingWorkspaceStore())?.clear(sessionId);
}

export async function loadWorkspacePage(sessionId: string, url: string, load: () => Promise<IliasPage>): Promise<CachedWorkspacePage> {
  const key = keyFor(sessionId, url);
  const shared = pending.get(key);
  if (shared) return shared;
  const task = Promise.resolve().then(async () => {
    const store = await workspaceStore();
    const cached = store.read(sessionId, url, workspacePageTtl);
    if (cached) return { page: cached.page, fetchedAt: cached.fetchedAt };
    const page = await load();
    const fetchedAt = Date.now();
    // A refresh/disconnect while the request was running must not resurrect it.
    if (page.authenticated && pending.get(key) === task)
      store.write(sessionId, { url, page, fetchedAt });
    return { page, fetchedAt };
  });
  pending.set(key, task);
  try { return await task; }
  finally { if (pending.get(key) === task) pending.delete(key); }
}
