import { liveWriteAllowed, requireLiveWrite } from "./write-policy";
import type { Session } from "./session";
import { objectUrl, upstreamUrl } from "./config";
import { fetchAuthenticatedHtml, IliasError } from "./client";
import { parseForumOverview, parseForumThread } from "./forum-parser";
import { demoForum, demoThread } from "./forum-demo";
import type { ForumOrder, ForumState } from "./forum-types";
import { emptyPage, getWorkspaceContext } from "./workspace-context";
import { validObjectId } from "./identifiers";
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
    !validObjectId(forumId) ||
    (threadId && !validObjectId(threadId)) ||
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
  const { workspace, session } = await getWorkspaceContext(demo);
  workspace.page = {
    ...emptyPage(
      objectUrl(workspace.instance, "frm", forumId),
      "Discussion forum",
    ),
    authenticated: workspace.mode === "live",
  };
  if (threadId) {
    const fallback = new URL(workspace.page.sourceUrl);
    fallback.searchParams.set("target", `frm_${forumId}_${threadId}`);
    workspace.page.sourceUrl = fallback.href;
  }
  const base = {
    workspace,
    forumId,
    threadId,
    page,
    order,
    writeAllowed: demo || liveWriteAllowed(workspace.instance, "frm", forumId),
  };
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
    workspace.userName = result.page.userName || workspace.userName;
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

export async function markForumThreadRead(
  session: Session,
  forumId: string,
  threadId: string,
) {
  if (!validObjectId(forumId) || !validObjectId(threadId))
    throw new IliasError("Invalid discussion.", 400);
  requireLiveWrite(session.instance, "frm", forumId);
  // Mutations always rediscover the authorized action from a fresh ILIAS page.
  const { thread } = await fetchForum(session, forumId, threadId);
  if (!thread?.markReadUrl)
    throw new IliasError(
      "This discussion is already read, or ILIAS has not offered that action. Refresh to see its current status.",
      409,
    );
  await fetchAuthenticatedHtml(session, thread.markReadUrl);
}
