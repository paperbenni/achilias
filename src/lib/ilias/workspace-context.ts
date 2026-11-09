import { profileName } from "./profile-name";
import { createHash } from "node:crypto";
import { currentSession } from "./session";
import { dashboardUrl, FREIBURG, instanceName } from "./config";
import type { IliasPage, Workspace } from "./types";

export function emptyPage(
  sourceUrl: string,
  title = "Learning space",
): IliasPage {
  return {
    title,
    description: "",
    items: [],
    tools: [],
    text: [],
    notices: [],
    breadcrumbs: [],
    sourceUrl,
    authenticated: false,
    userName: "",
    hasMore: false,
  };
}

/** Shared account context; never fetches upstream content or imports demo content. */
export async function getWorkspaceContext(demo = false) {
  const session = demo ? null : await currentSession();
  const instance = session?.instance || FREIBURG;
  const connected = session?.status === "connected";
  const workspace: Workspace = {
    readOnly: demo ? false : session?.readOnly !== false,
    mode: demo ? "demo" : connected ? "live" : "disconnected",
    instance,
    instanceName: instanceName(instance),
    userName: demo ? "Alex" : connected ? profileName(session.userName) : "",
    iliasVersion: connected ? session.iliasVersion : undefined,
    storageKey: connected
      ? createHash("sha256").update(session.id).digest("hex").slice(0, 16)
      : undefined,
    page: { ...emptyPage(dashboardUrl(instance)), authenticated: connected },
  };
  return { workspace, session };
}

/** Mutations from a stale tab must not act on a newly connected account. */
export async function requireWorkspaceConnection(expectedConnection: string) {
  const { session, workspace } = await getWorkspaceContext();
  if (session?.status !== "connected")
    throw new Error("Reconnect your account to use this action.");
  if (!expectedConnection || workspace.storageKey !== expectedConnection)
    throw new Error(
      "Your connection changed. Refresh this page before making changes.",
    );
  return session;
}
