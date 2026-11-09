"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { WorkspaceCrumb } from "@/lib/ilias/breadcrumbs";
import { advanceNavigation, type NavigationTrail, type VisitedPage } from "@/lib/navigation-trail";

type TrailContext = {
  state: NavigationTrail;
  visit: (page: VisitedPage, ancestors: WorkspaceCrumb[] | undefined, fallback: VisitedPage[]) => void;
};
const Context = createContext<TrailContext | null>(null);
const empty: NavigationTrail = { trail: [] };

/** Per-history-entry state preserves distinct origins for repeated visits.
 * Merge Next's metadata rather than intercepting links or router navigation.
 */
export function NavigationTrailProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const [state, setState] = useState<NavigationTrail>(empty);
  const current = useRef<NavigationTrail>(empty);
  const visit = useCallback((page: VisitedPage, ancestors: WorkspaceCrumb[] | undefined, fallback: VisitedPage[]) => {
    const saved = window.history.state?.achiliasTrail as
      (NavigationTrail & { scope: string; href: string }) | undefined;
    const restoring = saved?.scope === scope && saved.href === page.href;
    const base = restoring
      ? {
          trail: saved.trail,
          back: saved.back || saved.trail.at(-2),
          backIsHistory: saved.backIsHistory ?? saved.trail.length > 1,
          ancestors: saved.ancestors,
        }
      : current.current;
    // Reconcile restored trails too: old history may contain unrelated pages.
    const next = advanceNavigation(base, page, ancestors, fallback);
    current.current = next;
    window.history.replaceState({
      ...window.history.state,
      achiliasTrail: { scope, href: page.href, ...next },
    }, "");
    setState(next);
  }, [scope]);
  return <Context.Provider value={{ state, visit }}>{children}</Context.Provider>;
}

export function useNavigationTrail(
  title: string,
  fallback: VisitedPage[],
  ancestors: WorkspaceCrumb[] | undefined,
) {
  const context = useContext(Context);
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const href = pathname + (search ? `?${search}` : "");
  const visit = context?.visit;
  useEffect(() => { visit?.({ title, href }, ancestors, fallback); }, [visit, title, href, ancestors, fallback]);
  return advanceNavigation(context?.state || empty, { title, href }, ancestors, fallback);
}
