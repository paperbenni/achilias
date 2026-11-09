import { objectHref } from "./items";
import type { IliasPage } from "./types";

export type WorkspaceCrumb = {
  title: string;
  href?: string;
};

const rootTitle =
  /^(?:repository|magazin|dashboard|personal workspace|mein arbeitsbereich|workspace)$/i;

/**
 * Map ILIAS repository ancestors to app links for the optional location menu.
 * This is structural context, not the path the user took to the page.
 * The synthetic "My courses" root also serves as a direct-link fallback.
 */
export function workspaceCrumbs(
  page: IliasPage,
  demo: boolean,
): WorkspaceCrumb[] {
  const coursesHref = `/courses${demo ? "?demo=1" : ""}`;
  const result: WorkspaceCrumb[] = [];
  for (const crumb of page.breadcrumbs || []) {
    const title = crumb.title.trim();
    if (!title) continue;
    if (!result.length && rootTitle.test(title)) {
      result.push({ title: "My courses", href: coursesHref });
      continue;
    }
    const href =
      crumb.type && crumb.id
        ? objectHref(crumb.type, crumb.id, demo)
        : undefined;
    result.push({ title, ...(href ? { href } : {}) });
  }
  if (!result.length) {
    return [
      { title: "My courses", href: coursesHref },
      { title: page.title },
    ];
  }
  if (result[0].title !== "My courses") {
    result.unshift({ title: "My courses", href: coursesHref });
  } else if (!result[0].href) {
    result[0].href = coursesHref;
  }
  // Threads and exercise units are not repository objects, so ILIAS often
  // stops at their parent. Add the current page when it is missing.
  if (result[result.length - 1]?.title !== page.title) {
    result.push({ title: page.title });
  }
  return result;
}

/** The immediate parent is the "up" destination for a page. */
export function parentCrumb(crumbs: WorkspaceCrumb[]) {
  return crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;
}
