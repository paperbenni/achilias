import { objectUrl } from "./config";
import { fetchPage } from "./client";
import { isContainerType, itemKey } from "./items";
import { loadWorkspacePage } from "./page-cache";
import { indexedSearchItems, nearbySearchRoots } from "./search-index";
import type { Session } from "./session";
import type { Item } from "./types";

/** Bounded discovery of nearby containers. Each completed listing is published at
 * once; a slow course cannot hold up matches from the other worker. This never
 * submits ILIAS' stateful search form or visits activity/write controllers. */
export async function discoverNearby(
  session: Session,
  preferred: string[],
  signal: AbortSignal,
  publish: (items: Item[]) => void,
) {
  publish(await indexedSearchItems(session.id));
  const queue = (await nearbySearchRoots(session.id, preferred)).slice(0, 12).map((item) => ({ item, depth: 0 }));
  const visited = new Set<string>();
  let budget = 12;
  async function worker() {
    while (!signal.aborted && budget > 0) {
      const next = queue.shift();
      if (!next) return;
      const { item, depth } = next;
      const key = itemKey(item);
      if (visited.has(key)) continue;
      visited.add(key);
      budget--;
      try {
        const url = objectUrl(session.instance, item.type, item.id);
        const { page } = await loadWorkspacePage(session.id, url, () => fetchPage(session, url));
        if (signal.aborted) return;
        publish(page.items.map((child) => ({ ...child, context: child.context || page.title })));
        if (depth < 2) {
          // Explore the neighborhood before the remaining unrelated roots.
          queue.unshift(...page.items.filter((child) => child.available && isContainerType(child.type))
            .slice(0, 30).map((child) => ({ item: child, depth: depth + 1 })));
        }
      } catch (error) {
        // A restricted/deleted folder must not hide accessible siblings.
        if (error instanceof Error && "status" in error && error.status === 401) throw error;
      }
    }
  }
  await Promise.all([worker(), worker()]);
}
