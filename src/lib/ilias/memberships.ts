import { fetchPage } from "./client";
import { membershipsUrl } from "./config";
import { loadWorkspacePage } from "./page-cache";
import type { Session } from "./session";

/**
 * ilMembershipOverviewGUI renders the user's memberships independently of
 * dashboard favorites. ilMembershipBlockGUI uses the memberships provider;
 * ilDashboardBlockGUI sets PHP_INT_MAX as its limit, so all memberships render.
 */
export async function loadMemberships(session: Session) {
  const url = membershipsUrl(session.instance);
  const { page } = await loadWorkspacePage(session.id, url, () =>
    fetchPage(session, url),
  );
  return {
    items: page.items.filter((item) => item.type === "crs" || item.type === "grp"),
    hasMore: page.hasMore,
  };
}
