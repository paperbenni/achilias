import { createHash } from "node:crypto";
import { currentSession, type Session } from "./session";
import { FREIBURG, instanceName, objectUrl, upstreamUrl } from "./config";
import { fetchAuthenticatedHtml, IliasError } from "./client";
import { parseForumOverview, parseForumThread } from "./forum-parser";
import { demoForum, demoThread } from "./forum-demo";
import type { ForumOrder, ForumState } from "./forum-types";
import type { Workspace } from "./types";
export function validForumId(id: string) {
  return /^[1-9]\d{0,11}$/.test(id);
}
export function forumPageNumber(value?: string) {
  if (!value) return 0;
  if (!/^\d{1,5}$/.test(value)) throw new Error("Invalid forum page.");
  return Number(value);
}
export function forumOrder(value?: string): ForumOrder {
  if (!value || value === "conversation") return "conversation";
  if (value !== "oldest" && value !== "newest")
    throw new Error("Invalid post order.");
  return value;
}
export function forumViewUrl(
  instance: string,
  source: string,
  forumId: string,
  threadId: string | undefined,
  page: number,
  order: ForumOrder,
) {
  if (
    !validForumId(forumId) ||
    (threadId && !validForumId(threadId)) ||
    !Number.isInteger(page) ||
    page < 0 ||
    page > 99999
  )
    throw new Error("Invalid forum address.");
  const url = upstreamUrl(instance, source);
  if (!url.pathname.endsWith("/ilias.php"))
    throw new IliasError(
      "ILIAS did not return a forum controller page. Open the forum in ILIAS.",
    );
  for (const key of [
    "action",
    "file",
    "pos_pk",
    "mark_read",
    "draft_id",
    "anchor",
    "backurl",
    "thr_pk",
    "viewmode",
    "page",
  ])
    url.searchParams.delete(key);
  url.hash = "";
  url.searchParams.set("ref_id", forumId);
  url.searchParams.set("cmd", threadId ? "viewThread" : "showThreads");
  url.searchParams.set("page", String(page));
  if (threadId) {
    url.searchParams.set("thr_pk", threadId);
    url.searchParams.set(
      "viewmode",
      order === "conversation" ? "1" : order === "oldest" ? "2" : "3",
    );
  }
  return url.href;
}
export async function fetchForum(
  session: Session,
  forumId: string,
  threadId?: string,
  page = 0,
  order: ForumOrder = "conversation",
) {
  const overview = await fetchAuthenticatedHtml(
    session,
    objectUrl(session.instance, "frm", forumId),
  );
  const forum = parseForumOverview(overview.html, overview.url, forumId);
  if (!threadId && page === 0)
    return { forum, thread: null, page: overview.page };
  const view = await fetchAuthenticatedHtml(
    session,
    forumViewUrl(
      session.instance,
      overview.url,
      forumId,
      threadId,
      page,
      order,
    ),
  );
  return {
    forum: threadId ? forum : parseForumOverview(view.html, view.url, forumId),
    thread: threadId ? parseForumThread(view.html, view.url, threadId) : null,
    page: view.page,
  };
}
export async function getForumState(
  forumId: string,
  threadId?: string,
  demo = false,
  page = 0,
  order: ForumOrder = "conversation",
): Promise<ForumState> {
  const session = demo ? null : await currentSession();
  const instance = session?.instance || FREIBURG;
  const workspace: Workspace = {
    mode: demo
      ? "demo"
      : session?.status === "connected"
        ? "live"
        : "disconnected",
    instance,
    instanceName: instanceName(instance),
    userName: demo ? "Alex" : session?.userName || "",
    storageKey: session
      ? createHash("sha256").update(session.id).digest("hex").slice(0, 16)
      : undefined,
    page: {
      title: "Discussion forum",
      description: "",
      items: [],
      tools: [],
      text: [],
      notices: [],
      sourceUrl: objectUrl(instance, "frm", forumId),
      authenticated: session?.status === "connected",
      userName: "",
      hasMore: false,
    },
  };
  const base = { workspace, forumId, threadId, page, order };
  if (demo) {
    const forum = demoForum();
    const thread = threadId ? demoThread(threadId) : null;
    if (thread && order === "newest") thread.posts.reverse();
    workspace.page.title = thread?.title || forum.title;
    workspace.page.sourceUrl = thread?.sourceUrl || forum.sourceUrl;
    return { ...base, forum, thread };
  }
  if (session?.status !== "connected")
    return { ...base, forum: null, thread: null };
  try {
    const result = await fetchForum(session, forumId, threadId, page, order);
    workspace.page = { ...result.page, items: [] };
    workspace.page.title = result.thread?.title || result.forum.title;
    workspace.fetchedAt = new Date().toISOString();
    return { ...base, forum: result.forum, thread: result.thread };
  } catch (e) {
    workspace.error =
      e instanceof Error ? e.message : "Could not load this discussion.";
    return { ...base, forum: null, thread: null };
  }
}
