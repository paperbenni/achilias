import { liveWriteAllowed, requireLiveWrite } from "./write-policy";
import type { Session } from "./session";
import { objectUrl, upstreamUrl } from "./config";
import { fetchAuthenticatedHtml, IliasError } from "./client";
import { parseForumOverview, parseForumThread } from "./forum-parser";
import { demoForum, demoThread } from "./forum-demo";
import type {
  ForumOrder,
  ForumOverview,
  ForumState,
} from "./forum-types";
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

const forumSourceTtl = 5 * 60_000;
const previewTtl = 60_000;
const previewCacheLimit = 500;
const previewConcurrency = 4;
const forumSources = new Map<string, { at: number; url: string }>();
const pendingForumSources = new Map<string, Promise<string>>();
const previews = new Map<string, { at: number; value: string | null }>();
let activePreviews = 0;
const previewQueue: (() => void)[] = [];
const sourceKey = (session: Session, forumId: string) =>
  `${session.id}\n${forumId}`;
const previewKey = (session: Session, forumId: string, threadId: string) =>
  `${session.id}\n${forumId}\n${threadId}`;

function rememberForumSource(session: Session, forumId: string, url: string) {
  const key = sourceKey(session, forumId);
  forumSources.delete(key);
  forumSources.set(key, { at: Date.now(), url });
  while (forumSources.size > 200) {
    const oldest = forumSources.keys().next().value;
    if (oldest === undefined) break;
    forumSources.delete(oldest);
  }
}

function cachedForumSource(session: Session, forumId: string) {
  const key = sourceKey(session, forumId);
  const cached = forumSources.get(key);
  if (!cached) return;
  if (Date.now() - cached.at > forumSourceTtl) {
    forumSources.delete(key);
    return;
  }
  return cached.url;
}

async function forumSource(session: Session, forumId: string) {
  const cached = cachedForumSource(session, forumId);
  if (cached) return cached;
  const key = sourceKey(session, forumId);
  const pending = pendingForumSources.get(key);
  if (pending) return pending;
  const task = (async () => {
    const overview = await fetchAuthenticatedHtml(
      session,
      objectUrl(session.instance, "frm", forumId),
    );
    rememberForumSource(session, forumId, overview.url);
    return overview.url;
  })();
  pendingForumSources.set(key, task);
  try {
    return await task;
  } finally {
    pendingForumSources.delete(key);
  }
}

function readPreview(session: Session, forumId: string, threadId: string) {
  const key = previewKey(session, forumId, threadId);
  const cached = previews.get(key);
  if (!cached) return;
  if (Date.now() - cached.at > previewTtl) {
    previews.delete(key);
    return;
  }
  return cached.value;
}

function writePreview(
  session: Session,
  forumId: string,
  threadId: string,
  value: string | null,
) {
  const key = previewKey(session, forumId, threadId);
  previews.delete(key);
  previews.set(key, { at: Date.now(), value });
  while (previews.size > previewCacheLimit) {
    const oldest = previews.keys().next().value;
    if (oldest === undefined) break;
    previews.delete(oldest);
  }
}

/** Keep upstream preview loads bounded when several cards become visible. */
async function withPreviewSlot<T>(task: () => Promise<T>) {
  if (activePreviews >= previewConcurrency)
    await new Promise<void>((resolve) => previewQueue.push(resolve));
  activePreviews++;
  try {
    return await task();
  } finally {
    activePreviews--;
    previewQueue.shift()?.();
  }
}

function previewText(text: string) {
  const value = text.trim();
  if (value.length <= 600) return value;
  const cut = value.slice(0, 600);
  const space = cut.lastIndexOf(" ");
  return `${(space > 400 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Attach previews already fetched for this session; missing ones load on demand. */
function attachForumPreviews(
  session: Session,
  forumId: string,
  forum: ForumOverview,
) {
  for (const topic of forum.topics) {
    const cached = readPreview(session, forumId, topic.id);
    if (cached !== undefined) topic.preview = cached ?? "";
  }
}

/**
 * Read the opening post of a discussion for the overview card. This is a
 * read-only upstream request; it never adds ILIAS' mark-read action.
 */
export async function getForumThreadPreview(
  session: Session,
  forumId: string,
  threadId: string,
) {
  if (!validObjectId(forumId) || !validObjectId(threadId))
    throw new IliasError("Invalid discussion.", 400);
  const cached = readPreview(session, forumId, threadId);
  if (cached !== undefined) return cached;
  const source = await forumSource(session, forumId);
  const url = new URL(
    forumViewUrl(
      session.instance,
      source,
      forumId,
      threadId,
      0,
      "conversation",
    ),
  );
  // ILIAS persists an explicit viewmode in the session. Leave the user's
  // current thread view untouched and locate the root post in the response.
  url.searchParams.delete("viewmode");
  const page = await withPreviewSlot(() =>
    fetchAuthenticatedHtml(session, url.href),
  );
  const thread = parseForumThread(page.html, page.url, threadId);
  const opening =
    thread.posts.find((post) => post.depth === 0) || thread.posts[0];
  const preview = opening?.text ? previewText(opening.text) : null;
  writePreview(session, forumId, threadId, preview);
  return preview;
}

export function clearForumPreviews(sessionId?: string) {
  for (const key of previews.keys())
    if (sessionId === undefined || key.startsWith(`${sessionId}\n`))
      previews.delete(key);
  for (const key of forumSources.keys())
    if (sessionId === undefined || key.startsWith(`${sessionId}\n`))
      forumSources.delete(key);
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
  rememberForumSource(session, forumId, overview.url);
  if (!threadId && page === 0) {
    attachForumPreviews(session, forumId, forum);
    return { forum, thread: null, page: overview.page };
  }
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
  const viewedForum = threadId
    ? forum
    : parseForumOverview(view.html, view.url, forumId);
  if (!threadId) attachForumPreviews(session, forumId, viewedForum);
  return {
    forum: viewedForum,
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
