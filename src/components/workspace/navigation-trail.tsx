"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { WorkspaceCrumb } from "@/lib/ilias/breadcrumbs";

type Visit = WorkspaceCrumb & { href: string };
type TrailContext = { trail: Visit[]; visit: (page: Visit) => void };
const Context = createContext<TrailContext | null>(null);

/** Keep a trail on each browser history entry. This preserves the right origin
 * even when the same course was opened from different places. Next's existing
 * history fields stay intact; no links or router navigation are intercepted.
 */
export function NavigationTrailProvider({
  scope, children,
}: { scope: string; children: ReactNode }) {
  const [trail, setTrail] = useState<Visit[]>([]);
  const current = useRef<Visit[]>([]);
  const visit = useCallback((page: Visit) => {
    const saved = window.history.state?.achiliasTrail as
      { scope: string; href: string; trail: Visit[] } | undefined;
    const base = saved?.scope === scope && saved.href === page.href
      ? saved.trail
      : current.current;
    const existing = base.findIndex((entry) => entry.href === page.href);
    const entryPage = ["/", "/courses", "/saved", "/settings"].includes(page.href.split("?")[0]);
    const next = entryPage ? [page] : existing >= 0
      ? [...base.slice(0, existing), page]
      : [...base, page].slice(-50);
    current.current = next;
    // The native History API is supported by Next. Merge its router metadata.
    window.history.replaceState({
      ...window.history.state,
      achiliasTrail: { scope, href: page.href, trail: next },
    }, "");
    setTrail(next);
  }, [scope]);
  return <Context.Provider value={{ trail, visit }}>{children}</Context.Provider>;
}

export function useNavigationTrail(title: string, fallback: WorkspaceCrumb[]) {
  const context = useContext(Context);
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const href = pathname + (search ? `?${search}` : "");
  const visit = context?.visit;
  useEffect(() => { visit?.({ title, href }); }, [visit, title, href]);
  // Until the page registers, render its title rather than the previous page.
  const trail = context?.trail || [];
  const index = trail.findIndex((entry) => entry.href === href);
  const visited = index >= 0 ? trail.slice(0, index + 1) : [...trail, { title, href }];
  return visited.length > 1 ? visited : [...fallback, { title, href }];
}
