"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  ChevronRight,
  Copy,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  forumHref,
  type ForumOrder,
  type ForumPageLink,
  type ForumState,
} from "@/lib/ilias/forum-types";

function Original({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <ArrowUpRight data-icon="inline-end" />
      </a>
    </Button>
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
              prefetch={false}
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { forum, thread, forumId, threadId, workspace, page, order } = state;
  const demo = workspace.mode === "demo";
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [sort, setSort] = useState("source");
  const [marked, setMarked] = useState<string[]>([]);
  const [marking, setMarking] = useState(false);
  useEffect(() => {
    if (!demo) return;
    try {
      const ids = JSON.parse(
        sessionStorage.getItem("achilias:demo:read-threads") || "[]",
      );
      if (Array.isArray(ids))
        setMarked(ids.filter((id) => typeof id === "string"));
    } catch {
      /* Demo read state is optional. */
    }
  }, [demo]);
  if (!forum) return null;
  const source = demo
    ? workspace.instance
    : thread?.sourceUrl || forum.sourceUrl;
  const selected = forum.topics.find((topic) => topic.id === threadId);
  const isMarked = demo && !!threadId && marked.includes(threadId);
  const topics = forum.topics.map((topic) =>
    demo && marked.includes(topic.id) ? { ...topic, unread: 0 } : topic,
  );
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
  const firstUnread = !isMarked && thread?.posts.find((post) => post.unread);
  async function markRead() {
    if (!thread) return;
    setMarking(true);
    try {
      if (demo) {
        const next = [...new Set([...marked, thread.id])];
        sessionStorage.setItem(
          "achilias:demo:read-threads",
          JSON.stringify(next),
        );
        setMarked(next);
      } else {
        const response = await fetch(
          `/api/forums/${forumId}/threads/${thread.id}/read`,
          { method: "POST" },
        );
        if (!response.ok)
          throw new Error(
            (await response.json()).error || "Could not update read status.",
          );
        startTransition(() => router.refresh());
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
  async function copyPost(id: string) {
    try {
      const link = new URL(window.location.href);
      link.hash = `post-${id}`;
      await navigator.clipboard.writeText(link.href);
      toast.success("Link to this post copied");
    } catch {
      toast.error(
        "Could not copy the link. You can use the post’s address in your browser.",
      );
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
    <div className="flex min-w-0 flex-col gap-6" aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="w-fit" asChild>
          <Link
            prefetch={false}
            href={
              thread
                ? forumHref(forumId, demo)
                : demo
                  ? "/browse/crs/101?demo=1"
                  : "/"
            }
          >
            <ArrowLeft data-icon="inline-start" />
            {thread ? forum.title : "Back to your learning space"}
          </Link>
        </Button>
        <Original href={source}>Open in ILIAS</Original>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="eyebrow">
            {thread
              ? "A CONVERSATION WORTH FOLLOWING"
              : "THINK OUT LOUD. LEARN TOGETHER."}
          </p>
          <h1 className="page-title mt-3">{thread?.title || forum.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {thread ? (
              <>
                <MessageSquare className="size-4" />
                <span>
                  {thread.posts.length}{" "}
                  {thread.posts.length === 1 ? "post" : "posts"} on this page
                </span>
                {selected?.closed && (
                  <Badge variant="outline">
                    <LockKeyhole />
                    Closed
                  </Badge>
                )}
                {selected?.pinned && (
                  <Badge variant="secondary">
                    <Pin />
                    Pinned
                  </Badge>
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
        <div className="flex flex-wrap gap-2">
          {thread ? (
            <>
              {firstUnread && (
                <Button variant="outline" asChild>
                  <a href={`#post-${firstUnread.id}`}>
                    <ArrowDown data-icon="inline-start" />
                    Jump to unread
                  </a>
                </Button>
              )}
              {thread.markReadUrl && !isMarked && (
                <Button
                  variant="outline"
                  onClick={markRead}
                  disabled={marking || pending}
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
                <Original href={demo ? workspace.instance : thread.replyUrl}>
                  <Reply data-icon="inline-start" />
                  Reply in ILIAS
                </Original>
              )}
            </>
          ) : (
            forum.createUrl && (
              <Original href={demo ? workspace.instance : forum.createUrl}>
                <Plus data-icon="inline-start" />
                New topic in ILIAS
              </Original>
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
                          prefetch={false}
                          href={forumHref(forumId, demo, topic.id)}
                          className="py-5"
                        >
                          <ItemMedia variant="icon">
                            <MessageSquare />
                          </ItemMedia>
                          <ItemContent className="min-w-0">
                            <ItemTitle className="flex-wrap">
                              <span className="break-words">{topic.title}</span>
                              {topic.pinned && (
                                <Badge variant="secondary">
                                  <Pin />
                                  Pinned
                                </Badge>
                              )}
                              {topic.closed && (
                                <Badge variant="outline">
                                  <LockKeyhole />
                                  Closed
                                </Badge>
                              )}
                            </ItemTitle>
                            <ItemDescription>
                              {topic.author || "Author not available"}
                              {topic.lastActivity
                                ? ` · Last post ${topic.lastActivity}`
                                : ""}
                            </ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            {(topic.unread || 0) > 0 && (
                              <Badge>{topic.unread} unread</Badge>
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
              {posts.map((post) => {
                const parent = thread.posts.find((p) => p.id === post.parentId);
                const unread = post.unread && !isMarked;
                return (
                  <article
                    key={post.id}
                    id={`post-${post.id}`}
                    tabIndex={-1}
                    aria-label={`Post by ${post.author}`}
                    className={cn(
                      "scroll-mt-6 rounded-xl outline-none target:ring-2 target:ring-ring",
                      order === "conversation" && post.depth > 0 && "sm:ml-6",
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
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="break-words text-sm font-medium">
                                {post.author}
                              </h2>
                              {post.moderator && (
                                <Badge variant="secondary">Moderator</Badge>
                              )}
                              {unread && <Badge>Unread</Badge>}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {post.date || "Date not available"}
                            </p>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Copy link to post by ${post.author}`}
                                onClick={() => copyPost(post.id)}
                              >
                                <Copy />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Copy link to this post
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        {parent && (
                          <a
                            href={`#post-${parent.id}`}
                            className="mt-2 flex items-center gap-1.5 text-xs text-primary underline-offset-4 hover:underline"
                          >
                            <Reply className="size-3" />
                            In reply to {parent.author}
                          </a>
                        )}
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
                              <Original
                                key={i}
                                href={
                                  demo ? workspace.instance : attachment.url
                                }
                              >
                                <Paperclip data-icon="inline-start" />
                                {attachment.title}
                              </Original>
                            ))}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="flex-wrap justify-between gap-2">
                        <Button variant="link" size="sm" asChild>
                          <a href={`#post-${post.id}`}>#{post.id}</a>
                        </Button>
                        <div className="flex flex-wrap gap-2">
                          {post.replyUrl && (
                            <Original
                              href={demo ? workspace.instance : post.replyUrl}
                            >
                              <Reply data-icon="inline-start" />
                              Reply in ILIAS
                            </Original>
                          )}
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={demo ? workspace.instance : post.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Original post
                              <ArrowUpRight data-icon="inline-end" />
                            </a>
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  </article>
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
                        prefetch={false}
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
                    <Link prefetch={false} href={forumHref(forumId, demo)}>
                      All discussions
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Room for the whole discussion</CardTitle>
                  <CardDescription>
                    Read here. Reply, start topics, and manage subscriptions in
                    ILIAS. Attachments and embedded media open there too.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Unread badges reflect the loaded ILIAS page. Use “Mark
                    thread read” when you’re done. Page links load only when you
                    open them.
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
          <AlertTitle>Reading, with less friction</AlertTitle>
          <AlertDescription>
            Threads, replies, and unread counts are available here. Posting,
            subscriptions, moderation, and attachments still use the original
            forum.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
