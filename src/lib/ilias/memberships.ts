import { fetchPage } from "./client";
import { membershipsUrl } from "./config";
import { loadWorkspacePage } from "./page-cache";
import type { Session } from "./session";
import type { IliasPage } from "./types";

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

/**
 * Establish whether the current user is on a course/group's member list.
 * ILIAS' join tab is authoritative for non-members and its leave tab for
 * members. Without either, the cached membership overview is the fallback;
 * a paginated list cannot prove absence, so those pages stay unknown.
 */
export async function membershipStatus(
  session: Session,
  type: string,
  id: string,
  page: IliasPage,
): Promise<"member" | "guest" | undefined> {
  if (type !== "crs" && type !== "grp") return;
  if (page.joinUrl) return "guest";
  if (page.leaveUrl) return "member";
  try {
    const { items, hasMore } = await loadMemberships(session);
    if (items.some((item) => item.type === type && item.id === id))
      return "member";
    return hasMore ? undefined : "guest";
  } catch {
    // Membership is an enhancement; a failed lookup must not break the course.
    return;
  }
}
