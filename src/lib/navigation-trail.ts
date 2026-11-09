import type { WorkspaceCrumb } from "./ilias/breadcrumbs";

export type VisitedPage = WorkspaceCrumb & { href: string };
export type NavigationTrail = { trail: VisitedPage[]; back?: VisitedPage; backIsHistory?: boolean; ancestors?: WorkspaceCrumb[] };

/** View controls don't change which object the breadcrumb represents. */
export function navigationKey(href: string) {
  const url = new URL(href, "https://achilias.invalid");
  url.searchParams.delete("page");
  url.searchParams.delete("order");
  url.searchParams.sort();
  return url.pathname + url.search;
}

function entryPage(href: string) {
  return ["/", "/courses", "/saved", "/settings"].includes(new URL(href, "https://achilias.invalid").pathname);
}

/** Breadcrumbs are visited ancestors, not a chronological browsing log.
 * Back is tracked independently so going up or across still returns to the
 * actual origin. An undefined hierarchy means ILIAS provided no usable path.
 */
export function advanceNavigation(
  current: NavigationTrail,
  page: VisitedPage,
  ancestors: WorkspaceCrumb[] | undefined,
  fallback: VisitedPage[],
): NavigationTrail {
  const key = navigationKey(page.href);
  const previous = current.trail.at(-1);
  const back = previous && previous.href !== page.href
    ? previous
    : current.back && current.back.href !== page.href
      ? current.back
      : current.trail.slice(0, -1).findLast((entry) => entry.href !== page.href);
  const moved = previous && previous.href !== page.href;
  const backIsHistory = moved ? true : current.backIsHistory ?? false;
  if (entryPage(page.href)) return { trail: [page], back, backIsHistory };

  const existing = current.trail.findIndex((entry) => navigationKey(entry.href) === key);
  let base = existing >= 0 ? current.trail.slice(0, existing) : current.trail;
  // A location-menu jump is still known to go up when the destination's own
  // response omits its locator: the source page already identified that parent.
  const upIndex = current.ancestors?.findIndex((entry) => entry.href && navigationKey(entry.href) === key) ?? -1;
  const knownAncestors = ancestors ?? (upIndex >= 0 ? current.ancestors!.slice(0, upIndex) : undefined);
  if (knownAncestors !== undefined) {
    const positions = new Map(knownAncestors.flatMap((entry, index) =>
      entry.href ? [[navigationKey(entry.href), index] as const] : [],
    ));
    let lastPosition = -1;
    base = base.filter((entry) => {
      if (entryPage(entry.href)) return true;
      const position = positions.get(navigationKey(entry.href));
      if (position === undefined || position <= lastPosition) return false;
      lastPosition = position;
      return true;
    });
  }
  const origin = base.find((entry) => entryPage(entry.href)) || fallback[0];
  const resources = base.filter((entry) => !entryPage(entry.href));
  return {
    trail: [...(origin ? [origin] : []), ...resources, page].slice(-50),
    back: back || (origin && navigationKey(origin.href) !== key ? origin : undefined),
    backIsHistory,
    ancestors: knownAncestors,
  };
}
