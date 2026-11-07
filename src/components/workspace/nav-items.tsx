import { Bookmark, GraduationCap, Home, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type WorkspaceViewName =
  | "home"
  | "courses"
  | "browse"
  | "saved"
  | "settings"
  | "forum"
  | "exercise";

/** Append the demo marker so demo sessions never touch live ILIAS routes. */
export function demoHref(href: string, demo: boolean) {
  if (!demo) return href;
  return href.includes("?") ? `${href}&demo=1` : `${href}?demo=1`;
}

export type WorkspaceNavEntry = {
  view: WorkspaceViewName;
  title: string;
  /** Header breadcrumb label; differs from the sidebar title for courses. */
  crumb: string;
  icon: LucideIcon;
  href: string;
  /** Views this destination counts as current in the sidebar. */
  activeViews: WorkspaceViewName[];
};

/** The workspace destinations, shared by the sidebar and the quick-search palette. */
export const workspaceNav: WorkspaceNavEntry[] = [
  {
    view: "home",
    title: "Overview",
    crumb: "Overview",
    icon: Home,
    href: "/",
    activeViews: ["home"],
  },
  {
    view: "courses",
    title: "My courses",
    crumb: "Courses",
    icon: GraduationCap,
    href: "/courses",
    activeViews: ["courses", "browse", "forum", "exercise"],
  },
  {
    view: "saved",
    title: "Bookmarks",
    crumb: "Bookmarks",
    icon: Bookmark,
    href: "/saved",
    activeViews: ["saved"],
  },
];

/** Settings lives in the sidebar footer but rides along in the palette. */
export const settingsEntry = {
  title: "Features & connection",
  crumb: "Features & connection",
  icon: Settings2,
  href: "/settings",
};

/** Header breadcrumb label for a view, falling back to the page title. */
export function crumbFor(view: WorkspaceViewName, pageTitle: string) {
  if (view === "settings") return settingsEntry.crumb;
  return workspaceNav.find((entry) => entry.view === view)?.crumb || pageTitle;
}

/** The sidebar lives above the page, so it derives its active view from the URL. */
export function viewForPathname(pathname: string): WorkspaceViewName {
  if (pathname === "/") return "home";
  if (pathname === "/courses" || pathname.startsWith("/courses/"))
    return "courses";
  if (pathname === "/saved" || pathname.startsWith("/saved/")) return "saved";
  if (pathname === "/settings" || pathname.startsWith("/settings/"))
    return "settings";
  if (pathname.startsWith("/browse/")) return "browse";
  if (pathname.startsWith("/forums/")) return "forum";
  if (pathname.startsWith("/exercises/")) return "exercise";
  return "home";
}
