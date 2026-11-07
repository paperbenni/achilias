import type { Workspace } from "./types";
export type ForumPageLink = { page: number };
export type ForumTopic = {
  id: string;
  title: string;
  author: string;
  posts: number | null;
  unread: number | null;
  lastActivity: string;
  pinned: boolean;
  closed: boolean;
  sourceUrl: string;
  /** Discussion text preview. An empty string means "known to be empty". */
  preview?: string;
};
export type ForumOverview = {
  id: string;
  title: string;
  description: string;
  topics: ForumTopic[];
  sourceUrl: string;
  createUrl?: string;
  pages: ForumPageLink[];
  paginationDetected: boolean;
  recognized: boolean;
};
export type ForumPost = {
  id: string;
  title: string;
  author: string;
  date: string;
  body: string;
  text: string;
  depth: number;
  parentId?: string;
  unread: boolean;
  moderator: boolean;
  status: string;
  attachments: { title: string; url: string }[];
  hasEmbeddedContent: boolean;
  sourceUrl: string;
  replyUrl?: string;
};
export type ForumThread = {
  id: string;
  title: string;
  posts: ForumPost[];
  sourceUrl: string;
  replyUrl?: string;
  markReadUrl?: string;
  pages: ForumPageLink[];
  paginationDetected: boolean;
  limited: boolean;
  recognized: boolean;
};
export type ForumOrder = "conversation" | "oldest" | "newest";
export type ForumState = {
  writeAllowed: boolean;
  workspace: Workspace;
  forum: ForumOverview | null;
  thread: ForumThread | null;
  forumId: string;
  threadId?: string;
  page: number;
  order: ForumOrder;
};
export function forumHref(
  forumId: string,
  demo = false,
  threadId?: string,
  page = 0,
  order: ForumOrder = "conversation",
) {
  const params = new URLSearchParams();
  if (demo) params.set("demo", "1");
  if (page) params.set("page", String(page));
  if (threadId && order !== "conversation") params.set("order", order);
  return `/forums/${forumId}${threadId ? `/threads/${threadId}` : ""}${params.size ? `?${params}` : ""}`;
}
