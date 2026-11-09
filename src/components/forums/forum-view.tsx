"use client";
import { usePageShortcuts } from "@/hooks/use-page-shortcuts";
import { LiveWriteNotice } from "@/components/navigation/live-write-notice";
import { Fragment, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  ChevronRight,
  Info,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Paperclip,
  Pin,
  Plus,
  Reply,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OriginalLink } from "@/components/navigation/original-link";
import { RefreshButton } from "@/components/navigation/refresh-button";
import { ForumTopicPreview } from "./forum-topic-preview";
import { useBrowserStore } from "@/hooks/use-browser-store";
import { parentCrumb, workspaceCrumbs } from "@/lib/ilias/breadcrumbs";
import { cn } from "@/lib/utils";
import {
  forumHref,
  type ForumOrder,
  type ForumPageLink,
  type ForumState,
} from "@/lib/ilias/forum-types";

const emptyIds: string[] = [];
function decodeIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id) => typeof id === "string")
    : emptyIds;
}
const postReadKey = (threadId: string, postId: string) =>
  `${threadId}:${postId}`;

/** Structural metadata uses one quiet chip style everywhere. */
function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {children}
    </Badge>
  );
}

/** Unread is the one state that should stand out, so it is not a chip. */
function UnreadMark({ children = "Unread" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
      <span className="size-1.5 rounded-full bg-primary" aria-hidden />
      {children}
    </span>
  );
}
function Pagination({
  state,
  pages,
}: {
  state: ForumState;
  pages: ForumPageLink[];
}) {
  if (!pages.length) return null;
  const { forumId, threadId, page, order, workspace } = state;
  const demo = workspace.mode === "demo";
  const visible = [...new Set([page, ...pages.map((p) => p.page)])].sort(
    (a, b) => a - b,
  );
  return (
    <nav
      aria-label={threadId ? "Post pages" : "Discussion pages"}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <span className="text-xs text-muted-foreground">Page {page + 1}</span>
      <div className="flex flex-wrap gap-1">
        {visible.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={p === page ? "secondary" : "ghost"}
            asChild
          >
            <Link
              prefetch={demo}
              href={forumHref(
                forumId,
                workspace.mode === "demo",
                threadId,
                p,
                order,
              )}
              aria-current={p === page ? "page" : undefined}
              aria-label={`Page ${p + 1}`}
            >
              {p + 1}
            </Link>
          </Button>
        ))}
      </div>
    </nav>
  );
}
export function ForumView({ state }: { state: ForumState }) {
  const forumRoot = useRef<HTMLDivElement>(null);
  usePageShortcuts((event) => {
    if (event.key !== "j" && event.key !== "k") return;
    const entries = Array.from(forumRoot.current?.querySelectorAll<HTMLElement>(
      state.thread ? "article[data-post-kind]" : "[data-discussion-link]",
    ) || []);
    if (!entries.length) return;
    const current = entries.findIndex((entry) => entry.contains(document.activeElement));
    const index = current < 0 ? 0 : Math.max(0, Math.min(entries.length - 1, current + (event.key === "j" ? 1 : -1)));
    event.preventDefault();
    entries[index].focus({ preventScroll: true });
    entries[index].scrollIntoView({ block: "start", inline: "nearest" });
  });
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { forum, thread, forumId, threadId, workspace, order } = state;
  const demo = workspace.mode === "demo";
  const parent = parentCrumb(workspaceCrumbs(workspace.page, demo));
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [sort, setSort] = useState("source");
  const { value: marked, update: updateMarked } = useBrowserStore(
    "achilias:demo:read-threads",
    "sessionStorage",
    decodeIds,
    emptyIds,
  );
  const { value: readPosts, update: updateReadPosts } = useBrowserStore(
    "achilias:demo:read-posts",
    "sessionStorage",
    decodeIds,
    emptyIds,
  );
  const originalPostId = thread && state.page === 0 &&
    (order !== "newest" || (!thread.paginationDetected && thread.pages.length <= 1))
    ? (order === "newest" ? thread.posts.at(-1)?.id : thread.posts[0]?.id)
    : undefined;
  const [marking, setMarking] = useState(false);
  const [markingPost, setMarkingPost] = useState<string | null>(null);
  if (!forum) return null;
  const selected = forum.topics.find((topic) => topic.id === threadId);
  const isMarked = demo && !!threadId && marked.includes(threadId);
  const readPostCounts = new Map<string, number>();
  for (const key of readPosts) {
    const topicId = key.split(":")[0];
    readPostCounts.set(topicId, (readPostCounts.get(topicId) || 0) + 1);
  }
  const topics = forum.topics.map((topic) => {
    if (!demo) return topic;
    if (marked.includes(topic.id)) return { ...topic, unread: 0 };
    const readHere = readPostCounts.get(topic.id) || 0;
    if (!readHere || !topic.unread) return topic;
    return { ...topic, unread: Math.max(0, topic.unread - readHere) };
  });
  const unreadThreads = topics.filter(
    (topic) => (topic.unread || 0) > 0,
  ).length;
  const filteredTopics = topics.filter(
    (topic) =>
      (tab !== "unread" || (topic.unread || 0) > 0) &&
      `${topic.title} ${topic.author}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  if (sort === "title")
    filteredTopics.sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title),
    );
  if (sort === "activity")
    filteredTopics.sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || (b.posts || 0) - (a.posts || 0),
    );
  const posts =
    thread?.posts.filter((post) =>
      `${post.title} ${post.author} ${post.text}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) || [];
  const firstUnread =
    !isMarked &&
    posts.find(
      (post) =>
        post.unread &&
        !(threadId && readPosts.includes(postReadKey(threadId, post.id))),
    );
  async function markRead() {
    if (!thread) return;
    setMarking(true);
    try {
      if (demo) {
        if (!updateMarked((current) => [...new Set([...current, thread.id])]))
          throw new Error("Your browser could not save this change.");
      } else {
        // One HTTP write path for read state, shared with the headless smokes.
        const response = await fetch(
          `/api/forums/${forumId}/threads/${thread.id}/read`,
          {
            method: "POST",
            headers: { "x-achilias-connection": workspace.storageKey || "" },
            cache: "no-store",
          },
        );
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!response.ok)
          throw new Error(body.error || "Could not update read status.");
        router.refresh();
      }
      toast.success(
        demo ? "Marked read in this demo" : "Discussion marked read in ILIAS",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not update read status.",
      );
    } finally {
      setMarking(false);
    }
  }

  async function markPostRead(postId: string) {
    if (!thread) return;
    setMarkingPost(postId);
    try {
      if (demo) {
        const key = postReadKey(thread.id, postId);
        if (!updateReadPosts((current) => [...new Set([...current, key])]))
          throw new Error("Your browser could not save this change.");
        toast.success("Post marked read in this demo");
      } else {
        const response = await fetch(
          `/api/forums/${forumId}/threads/${thread.id}/read`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-achilias-connection": workspace.storageKey || "",
            },
            body: JSON.stringify({ postId, page: state.page }),
            cache: "no-store",
          },
        );
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!response.ok)
          throw new Error(body.error || "Could not update read status.");
        router.refresh();
        toast.success("Post marked read in ILIAS");
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not update read status.",
      );
    } finally {
      setMarkingPost(null);
    }
  }

  function empty(title: string, description: string) {
    return (
      <Empty className="min-h-52 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquare />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div
      ref={forumRoot}
      className="flex min-w-0 flex-col gap-6"
      aria-busy={pending || marking || !!markingPost}
    >
      {!state.writeAllowed && (
        <LiveWriteNotice sourceUrl={workspace.page.sourceUrl} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {thread ? (
          <Button
            variant="ghost"
            className="h-auto w-fit max-w-full justify-start whitespace-normal py-2 text-left"
            asChild
          >
            <Link prefetch={demo} href={forumHref(forumId, demo)}>
              <ArrowLeft data-icon="inline-start" />
              {forum.title}
            </Link>
          </Button>
        ) : parent?.href ? (
          <Button
            variant="ghost"
            className="h-auto w-fit max-w-full justify-start whitespace-normal py-2 text-left"
            asChild
          >
            <Link prefetch={demo} href={parent.href}>
              <ArrowLeft data-icon="inline-start" />
              Back to {parent.title}
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <h1 className="page-title">{thread?.title || forum.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {thread ? (
              <>
                <MessageSquare className="size-4" />
                <span>
                  {thread.posts.length}{" "}
                  {thread.posts.length === 1 ? "post" : "posts"} on this page
                </span>
                {selected?.closed && (
                  <MetaBadge>
                    <LockKeyhole />
                    Closed
                  </MetaBadge>
                )}
                {selected?.pinned && (
                  <MetaBadge>
                    <Pin />
                    Pinned
                  </MetaBadge>
                )}
              </>
            ) : (
              <p className="leading-relaxed">
                {forum.description ||
                  "Questions, explanations, and useful conversations from your course."}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshButton iconOnly />
          {thread ? (
            <>
              {thread.markReadUrl && !isMarked && (
                <Button
                  variant="outline"
                  onClick={markRead}
                  disabled={
                    marking || !!markingPost || pending || !state.writeAllowed
                  }
                >
                  {marking ? (
                    <Loader2
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <CheckCheck data-icon="inline-start" />
                  )}
                  Mark thread read
                </Button>
              )}
              {thread.replyUrl && (
                <Button asChild>
                  <a
                    href={demo ? workspace.instance : thread.replyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Reply data-icon="inline-start" />
                    Reply in ILIAS
                    <ArrowUpRight data-icon="inline-end" />
                  </a>
                </Button>
              )}
            </>
          ) : (
            forum.createUrl && (
              <Button asChild>
                <a
                  href={demo ? workspace.instance : forum.createUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Plus data-icon="inline-start" />
                  New topic in ILIAS
                  <ArrowUpRight data-icon="inline-end" />
                </a>
              </Button>
            )
          )}
        </div>
      </div>
      {workspace.page.notices.map((notice, index) => (
        <Alert key={index}>
          <Info />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ))}
      {(!forum.recognized || (thread && !thread.recognized)) && (
        <Alert>
          <Info />
          <AlertTitle>This forum layout needs the original page</AlertTitle>
          <AlertDescription>
            Achilias could not recognize the full discussion layout. Open ILIAS
            to check the available content and your permissions.
          </AlertDescription>
        </Alert>
      )}
      {thread?.limited && (
        <Alert>
          <Info />
          <AlertTitle>ILIAS is showing part of this conversation</AlertTitle>
          <AlertDescription>
            A branch was selected in the original forum. Use the original page’s
            full-thread control to restore the complete view.
          </AlertDescription>
        </Alert>
      )}
      {!thread ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ToggleGroup
              type="single"
              value={tab}
              onValueChange={(value) => value && setTab(value)}
              variant="outline"
              spacing={0}
              aria-label="Discussion filter"
            >
              <ToggleGroupItem value="all">
                All discussions{" "}
                <Badge variant="secondary">{topics.length}</Badge>
              </ToggleGroupItem>
              <ToggleGroupItem value="unread">
                Unread <Badge variant="secondary">{unreadThreads}</Badge>
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-56">
                <InputGroup>
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-label="Search discussions on this page"
                    placeholder="Find a topic or author…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </InputGroup>
              </div>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger aria-label="Sort discussions">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="source">Forum order</SelectItem>
                    <SelectItem value="title">Title A–Z</SelectItem>
                    <SelectItem value="activity">Most posts</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {query
              ? `${filteredTopics.length} matching ${filteredTopics.length === 1 ? "discussion" : "discussions"}. `
              : ""}
            Search, filters, and sorting apply to this page. Unread counts come
            from {demo ? "the example data" : "ILIAS"}.
          </p>
          {filteredTopics.length ? (
            <Card>
              <CardContent>
                <ItemGroup aria-label="Forum discussions">
                  {filteredTopics.map((topic) => (
                    <div key={topic.id} role="listitem">
                      <Item asChild>
                        <Link
                          prefetch={demo}
                          href={forumHref(forumId, demo, topic.id)}
                          data-discussion-link
                          className="scroll-mt-6 py-5"
                        >
                          <ItemMedia variant="icon">
                            <MessageSquare />
                          </ItemMedia>
                          <ItemContent className="min-w-0">
                            <ItemTitle className="flex-wrap">
                              <span className="break-words">{topic.title}</span>
                              {topic.pinned && (
                                <MetaBadge>
                                  <Pin />
                                  Pinned
                                </MetaBadge>
                              )}
                              {topic.closed && (
                                <MetaBadge>
                                  <LockKeyhole />
                                  Closed
                                </MetaBadge>
                              )}
                            </ItemTitle>
                            <ForumTopicPreview
                              key={`${topic.id}:${topic.preview === undefined ? "unknown" : topic.preview}`}
                              forumId={forumId}
                              threadId={topic.id}
                              connection={workspace.storageKey}
                              initialPreview={topic.preview}
                            />
                            <ItemDescription className="text-xs">
                              {topic.author || "Author not available"}
                              {topic.lastActivity
                                ? ` · Last post ${topic.lastActivity}`
                                : ""}
                            </ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            {(topic.unread || 0) > 0 && (
                              <UnreadMark>{topic.unread} unread</UnreadMark>
                            )}
                            {topic.posts !== null && (
                              <span className="hidden text-xs text-muted-foreground sm:inline">
                                {topic.posts}{" "}
                                {topic.posts === 1 ? "post" : "posts"}
                              </span>
                            )}
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </ItemActions>
                        </Link>
                      </Item>
                    </div>
                  ))}
                </ItemGroup>
              </CardContent>
            </Card>
          ) : (
            empty(
              query
                ? "No matching discussions"
                : tab === "unread"
                  ? "No unread discussions reported"
                  : "No discussions found",
              query
                ? "Try another topic or author, or clear the search."
                : tab === "unread"
                  ? "No discussions on this page have reported unread posts. Other pages may have more."
                  : "The forum may be empty, restricted, or use a different layout. Check the original page if you expected a discussion here.",
            )
          )}
          <Pagination state={state} pages={forum.pages} />
          {forum.paginationDetected && !forum.pages.length && (
            <Alert>
              <Info />
              <AlertDescription>
                ILIAS has additional page controls that Achilias could not read.
                Open the original forum to see further discussions.
              </AlertDescription>
            </Alert>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ToggleGroup
              type="single"
              value={order}
              onValueChange={(value) => {
                if (value)
                  startTransition(() =>
                    router.push(
                      forumHref(
                        forumId,
                        demo,
                        thread.id,
                        0,
                        value as ForumOrder,
                      ),
                    ),
                  );
              }}
              variant="outline"
              spacing={0}
              aria-label="Post order"
            >
              <ToggleGroupItem value="conversation">
                Conversation
              </ToggleGroupItem>
              <ToggleGroupItem value="oldest">Oldest first</ToggleGroupItem>
              <ToggleGroupItem value="newest">Newest first</ToggleGroupItem>
            </ToggleGroup>
            <div className="w-full sm:w-64">
              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label="Search posts on this page"
                  placeholder="Find words or a person…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </InputGroup>
            </div>
          </div>
          <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_240px]">
            <section
              aria-label="Discussion posts"
              className="flex min-w-0 flex-col gap-4"
            >
              {query && (
                <p role="status" className="text-xs text-muted-foreground">
                  {posts.length} matching{" "}
                  {posts.length === 1 ? "post" : "posts"} on this page. Clear
                  the search to restore the conversation.
                </p>
              )}
              {!posts.length &&
                empty(
                  query ? "No matching posts" : "No posts found",
                  query
                    ? "Try a different word or author."
                    : "Check the original thread for available content and access requirements.",
                )}
              {posts.map((post, index) => {
                const parent = thread.posts.find((p) => p.id === post.parentId);
                const unread =
                  post.unread &&
                  !isMarked &&
                  !(
                    threadId &&
                    readPosts.includes(postReadKey(threadId, post.id))
                  );
                const isOriginal = post.id === originalPostId;
                const firstReply = !isOriginal && index > 0 && posts[index - 1].id === originalPostId;
                return (
                  <Fragment key={post.id}>
                    {firstReply && order !== "newest" && (
                      <div role="separator" aria-label="Replies" className="mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Reply className="size-4" /> Replies
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <article
                      data-post-kind={isOriginal ? "original" : "reply"}
                      id={`post-${post.id}`}
                      tabIndex={-1}
                      aria-label={`Post by ${post.author}`}
                      className={cn(
                        "forum-post scroll-mt-6 rounded-xl outline-none target:ring-2 target:ring-ring",
                        !isOriginal && "ml-2 rounded-none border-l-2 border-border pl-3 sm:ml-6 sm:pl-4",
                        !isOriginal && order === "conversation" && post.depth > 1 && "sm:ml-10",
                      )}
                    >
                      <Card>
                        <CardHeader>
                          <div className="flex items-start gap-3">
                            <Avatar className="size-9">
                              <AvatarFallback>
                                {post.author
                                  .split(/\s+/)
                                  .slice(0, 2)
                                  .map((s) => s[0])
                                  .join("")
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <h2 className="break-words text-sm font-medium">
                                  {post.author}
                                </h2>
                                {post.moderator && (
                                  <MetaBadge>Moderator</MetaBadge>
                                )}
                                {unread && <UnreadMark />}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {isOriginal && (
                                  <span className="font-medium">
                                    Original post
                                  </span>
                                )}
                                {isOriginal ? " · " : ""}
                                {post.date || "Date not available"}
                              </p>
                              {parent && (
                                <a
                                  href={`#post-${parent.id}`}
                                  className="mt-1.5 flex items-center gap-1.5 text-xs text-primary underline-offset-4 hover:underline"
                                >
                                  <Reply className="size-3" />
                                  In reply to {parent.author}
                                </a>
                              )}
                            </div>
                          </div>
                          <CardAction>
                            <Button variant="ghost" size="icon-sm" asChild>
                              <a
                                href={demo ? workspace.instance : post.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Open post in ILIAS"
                                title="Open post in ILIAS"
                              >
                                <ArrowUpRight />
                              </a>
                            </Button>
                          </CardAction>
                        </CardHeader>
                        <CardContent className="flex min-w-0 flex-col gap-4">
                          {post.status && (
                            <Alert>
                              <Info />
                              <AlertDescription>{post.status}</AlertDescription>
                            </Alert>
                          )}
                          {post.title &&
                            post.title !== thread.title &&
                            post.title.replace(/^re:\s*/i, "") !==
                              thread.title && (
                              <h3 className="text-sm font-medium">
                                {post.title}
                              </h3>
                            )}
                          <div
                            className="forum-prose"
                            dangerouslySetInnerHTML={{ __html: post.body }}
                          />
                          {post.hasEmbeddedContent && (
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              This post includes media or mathematical content.
                              Open the original post for the full content.
                            </p>
                          )}
                          {post.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {post.attachments.map((attachment, i) => (
                                <OriginalLink
                                  compact
                                  key={i}
                                  href={
                                    demo ? workspace.instance : attachment.url
                                  }
                                >
                                  <Paperclip data-icon="inline-start" />
                                  {attachment.title}
                                </OriginalLink>
                              ))}
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="flex-wrap justify-between gap-2">
                          <Button variant="link" size="sm" asChild>
                            <a href={`#post-${post.id}`}>#{post.id}</a>
                          </Button>
                          <div className="flex flex-wrap items-center gap-2">
                            {unread && (demo || post.markReadUrl) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markPostRead(post.id)}
                                disabled={
                                  markingPost === post.id ||
                                  marking ||
                                  pending ||
                                  !state.writeAllowed
                                }
                              >
                                {markingPost === post.id ? (
                                  <Loader2
                                    data-icon="inline-start"
                                    className="animate-spin"
                                  />
                                ) : (
                                  <CheckCheck data-icon="inline-start" />
                                )}
                                Mark read
                              </Button>
                            )}
                            {post.replyUrl && (
                              <Button variant="outline" size="sm" asChild>
                                <a
                                  href={demo ? workspace.instance : post.replyUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Reply data-icon="inline-start" />
                                  Reply in ILIAS
                                  <ArrowUpRight data-icon="inline-end" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </CardFooter>
                      </Card>
                    </article>
                  </Fragment>
                );
              })}
              <Pagination state={state} pages={thread.pages} />
              {thread.paginationDetected && !thread.pages.length && (
                <Alert>
                  <Info />
                  <AlertDescription>
                    More posts may be available through the original thread’s
                    page controls.
                  </AlertDescription>
                </Alert>
              )}
            </section>
            <aside className="flex min-w-0 flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>In this forum</CardTitle>
                  <CardDescription>
                    Discussions from the forum’s first page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {topics.slice(0, 5).map((topic) => (
                    <Button
                      key={topic.id}
                      variant={topic.id === thread.id ? "secondary" : "ghost"}
                      className="h-auto justify-start whitespace-normal py-2 text-left"
                      asChild
                    >
                      <Link
                        prefetch={demo}
                        href={forumHref(forumId, demo, topic.id)}
                        aria-current={
                          topic.id === thread.id ? "page" : undefined
                        }
                      >
                        {topic.pinned && <Pin data-icon="inline-start" />}
                        {topic.title}
                      </Link>
                    </Button>
                  ))}
                </CardContent>
                <CardFooter>
                  <Button variant="link" asChild>
                    <Link prefetch={demo} href={forumHref(forumId, demo)}>
                      All discussions
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Posting and unread status</CardTitle>
                  <CardDescription>
                    Replies, new topics, subscriptions, attachments and embedded
                    media use ILIAS.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Unread markers reflect the loaded ILIAS page. Mark
                    individual posts read, or mark the whole thread when you’re
                    done. Page links load only when you open them.
                  </p>
                </CardContent>
              </Card>
            </aside>
          </div>
        </>
      )}
      {!thread && (
        <Alert>
          <Info />
          <AlertTitle>Actions available in ILIAS</AlertTitle>
          <AlertDescription>
            Posting, subscriptions, moderation and attachments use the original
            forum.
          </AlertDescription>
        </Alert>
      )}
      {firstUnread && (
        <div className="fixed right-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-30 sm:right-6 print:hidden">
          <Button
            variant="secondary"
            className="h-10 rounded-full border-border px-4 shadow-lg"
            asChild
          >
            <a href={`#post-${firstUnread.id}`}>
              <ArrowDown data-icon="inline-start" />
              Jump to unread
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
