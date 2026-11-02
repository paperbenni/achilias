import { createHash } from "node:crypto";
import { currentSession } from "./session";
import { FREIBURG, instanceName, objectUrl } from "./config";
import { fetchPage } from "./client";
import { demoPage } from "./demo";
import type { Workspace } from "./types";
export async function getWorkspace(
  demo = false,
  type?: string,
  id?: string,
): Promise<Workspace> {
  if (demo)
    return {
      mode: "demo",
      instance: FREIBURG,
      instanceName: "University of Freiburg",
      userName: "Alex",
      page: demoPage(type, id),
    };
  const session = await currentSession();
  const instance = session?.instance || FREIBURG;
  const empty = {
    ...demoPage(),
    items: [],
    tools: [],
    text: [],
    userName: "",
    authenticated: false,
  };
  if (session?.status !== "connected")
    return {
      mode: "disconnected",
      instance,
      instanceName: instanceName(instance),
      userName: "",
      page: empty,
    };
  const storageKey = createHash("sha256")
    .update(session.id)
    .digest("hex")
    .slice(0, 16);
  try {
    const url =
      type && id
        ? objectUrl(instance, type, id)
        : new URL("ilias.php?baseClass=ilDashboardGUI", instance).href;
    const page = await fetchPage(session, url);
    return {
      storageKey,
      mode: "live",
      instance,
      instanceName: instanceName(instance),
      userName: page.userName || session.userName || "",
      page,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      storageKey,
      mode: "live",
      instance,
      instanceName: instanceName(instance),
      userName: session.userName || "",
      page: {
        ...empty,
        title: "Let’s get you back to learning",
        sourceUrl:
          type && id
            ? objectUrl(instance, type, id)
            : new URL("ilias.php?baseClass=ilDashboardGUI", instance).href,
      },
      error: e instanceof Error ? e.message : "Could not load ILIAS.",
    };
  }
}
