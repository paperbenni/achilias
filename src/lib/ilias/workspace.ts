import { membershipsUrl, objectUrl } from "./config";
import { fetchPage } from "./client";
import { loadWorkspacePage } from "./page-cache";
import { demoPage } from "./demo";
import { typeNames } from "./items";
import { membershipStatus } from "./memberships";
import { getWorkspaceContext } from "./workspace-context";
import type { IliasPage, Workspace } from "./types";

/**
 * A redirect to the dashboard, login flow, or parent course means ILIAS did
 * not open the requested object. Comparing the final reference prevents a
 * failed course request from rendering an unrelated page as course content.
 */
function pageMatchesObject(page: IliasPage, type: string, id: string) {
  try {
    const url = new URL(page.sourceUrl);
    const ref = url.searchParams.get("ref_id");
    if (ref) return ref === id;
    const target = url.searchParams.get("target");
    if (target)
      return target === `${type}_${id}` || target.startsWith(`${type}_${id}_`);
    const match = url.pathname.match(/\/go(?:to(?:\.php)?)?\/([a-z]+)\/(\d+)/i);
    return !!match && match[1].toLowerCase() === type && match[2] === id;
  } catch {
    return false;
  }
}

export async function getWorkspace(
  demo = false,
  type?: string,
  id?: string,
): Promise<Workspace> {
  const { workspace, session } = await getWorkspaceContext(demo);
  if (demo) return { ...workspace, page: demoPage(type, id) };
  // Home and My courses must include all memberships, even when the user has
  // no dashboard favorites. Object pages still load their own listing.
  workspace.page.sourceUrl = type && id
    ? objectUrl(workspace.instance, type, id)
    : membershipsUrl(workspace.instance);
  if (session?.status !== "connected") return workspace;
  const sourceUrl = workspace.page.sourceUrl;
  try {
    const { page, fetchedAt } = await loadWorkspacePage(
      session.id,
      sourceUrl,
      () => fetchPage(session, sourceUrl),
    );
    if (type && id && !pageMatchesObject(page, type, id)) {
      return {
        ...workspace,
        page: {
          ...workspace.page,
          title: `${typeNames[type] || "Learning space"} unavailable`,
          description: "",
          items: [],
          tools: [],
          text: [],
          notices: [],
          sourceUrl,
          authenticated: true,
        },
        unavailable: true,
        error:
          "ILIAS did not open this object. You may not have access, or it may have been removed. Open it in ILIAS to check your access.",
      };
    }
    const membership =
      type && id ? await membershipStatus(session, type, id, page) : undefined;
    return {
      ...workspace,
      userName: page.userName || workspace.userName,
      page: membership ? { ...page, membership } : page,
      fetchedAt: new Date(fetchedAt).toISOString(),
    };
  } catch (error) {
    return {
      ...workspace,
      page: { ...workspace.page, title: "Let’s get you back to learning" },
      error: error instanceof Error ? error.message : "Could not load ILIAS.",
    };
  }
}

export async function getWorkspaceMetadata(demo = false): Promise<Workspace> {
  return (await getWorkspaceContext(demo)).workspace;
}
