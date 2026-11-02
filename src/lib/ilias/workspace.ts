import { objectUrl } from "./config";
import { fetchPage } from "./client";
import { demoPage } from "./demo";
import { getWorkspaceContext } from "./workspace-context";
import type { Workspace } from "./types";

export async function getWorkspace(
  demo = false,
  type?: string,
  id?: string,
): Promise<Workspace> {
  const { workspace, session } = await getWorkspaceContext(demo);
  if (demo) return { ...workspace, page: demoPage(type, id) };
  if (type && id)
    workspace.page.sourceUrl = objectUrl(workspace.instance, type, id);
  if (session?.status !== "connected") return workspace;
  try {
    const page = await fetchPage(session, workspace.page.sourceUrl);
    return {
      ...workspace,
      userName: page.userName || workspace.userName,
      page,
      fetchedAt: new Date().toISOString(),
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
