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
    mode: demo ? "demo" : connected ? "live" : "disconnected",
    instance,
    instanceName: instanceName(instance),
    userName: demo ? "Alex" : connected ? session.userName || "" : "",
    storageKey: connected
      ? createHash("sha256").update(session.id).digest("hex").slice(0, 16)
      : undefined,
    page: { ...emptyPage(dashboardUrl(instance)), authenticated: connected },
  };
  return { workspace, session };
}
