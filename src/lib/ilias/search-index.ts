import { itemKey, isContainerType } from "./items";
import { mergeItems } from "./library";
import type { Item } from "./types";

import { workspaceStore } from "./workspace-store";

export function containerKey(value: string): boolean {
  return /^(crs|grp|fold|cat):[1-9]\d{0,11}$/.test(value);
}
async function listingsFor(sessionId: string) {
  const listings = (await workspaceStore()).listings(sessionId).map(({ url, page }) => {
    let target = "";
    try { target = new URL(url).searchParams.get("target") || ""; } catch {}
    const root: Item | undefined = containerKey(target.replace("_", ":")) ? {
      id: target.split("_")[1], type: target.split("_")[0], title: page.title,
      description: page.description, meta: "", sourceUrl: url, available: true,
    } : undefined;
    return { root, items: page.items };
  });
  const parents = new Map<string, Item>();
  for (const { root, items } of listings)
    if (root) for (const item of items)
      if (!parents.has(itemKey(item))) parents.set(itemKey(item), root);
  function path(root: Item): string {
    const parts = [root.title];
    const seen = new Set([itemKey(root)]);
    let parent = parents.get(itemKey(root));
    while (parent && !seen.has(itemKey(parent)) && parts.length < 8) {
      seen.add(itemKey(parent));
      parts.unshift(parent.title);
      parent = parents.get(itemKey(parent));
    }
    return parts.join(" › ");
  }
  return listings.map(({ root, items }) => ({ root, items: items.map((item) => ({
    ...item, context: item.context || (root ? path(root) : undefined),
  })) }));
}
export async function indexedSearchItems(sessionId: string): Promise<Item[]> {
  return mergeItems(...(await listingsFor(sessionId)).map(({ items }) => items)).slice(0, 4000);
}
/** Parents of recently opened folders find siblings before exploring unrelated courses. */
export async function nearbySearchRoots(sessionId: string, preferred: string[] = []): Promise<Item[]> {
  const listings = await listingsFor(sessionId);
  const recent = mergeItems(
    preferred.flatMap((key) => listings.flatMap(({ root, items }) =>
      [root, ...items].filter((item): item is Item => !!item && itemKey(item) === key))),
    listings.flatMap(({ root }) => root ? [root] : []),
  ).slice(0, 4);
  const parents = recent.flatMap((child) => listings.flatMap(({ root, items }) =>
    root && items.some((item) => itemKey(item) === itemKey(child)) ? [root] : []));
  return mergeItems(parents, recent, await indexedSearchItems(sessionId))
    .filter((item) => item.available && isContainerType(item.type));
}
