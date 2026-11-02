"use client";
import { Navigation, type WorkspaceViewName } from "./navigation";
import { SettingsView } from "./settings-view";
import { ItemList } from "./item-list";
import { downloadFile } from "@/lib/browser-download";
import { useLibrary } from "@/hooks/use-library";
import { mergeItems } from "@/lib/ilias/library";
import { iconFor } from "./item-icon";
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  Home,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  University,
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { ConnectDialog } from "./connect-dialog";
import {
  isSupportedItemType,
  isNavigableItem,
  itemKey,
  itemHref,
  typeNames,
} from "@/lib/ilias/items";
import type { Item, Workspace } from "@/lib/ilias/types";

import { ItemAction } from "@/components/navigation/item-action";
import { ParsedHtmlNotice } from "@/components/navigation/parsed-html-notice";
import { OriginalLink } from "@/components/navigation/original-link";
import { RefreshButton } from "@/components/navigation/refresh-button";

type DeepSearch = {
  query: string;
  results: Item[];
  sourceUrl: string;
  hasMore: boolean;
};

function searchMatches(item: Item, terms: string[]) {
  const haystack = [
    item.title,
    item.description,
    item.meta,
    item.context,
    item.id,
    typeNames[item.type],
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function searchResultIcon(type: string) {
  return createElement(iconFor(type), { className: "mt-0.5" });
}

function SearchResultOption({
  item,
  onSelect,
}: {
  item: Item;
  onSelect: (item: Item) => void;
}) {
  return (
    <CommandItem
      value={itemKey(item)}
      onSelect={() => onSelect(item)}
      className="items-start py-2"
    >
      {searchResultIcon(item.type)}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{item.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {item.context ||
            item.description ||
            item.meta ||
            "Open this item in ILIAS"}
        </span>
      </span>
      <span className="shrink-0 self-center text-xs text-muted-foreground">
        {!item.available ? "Restricted" : typeNames[item.type] || "In ILIAS"}
      </span>
    </CommandItem>
  );
}

export function WorkspaceView({
  data,
  view = "home",
  children,
}: {
  children?: React.ReactNode;
  data: Workspace;
  view?: WorkspaceViewName;
}) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [layout, setLayout] = useState("grid");
  const [deep, setDeep] = useState<DeepSearch | null>(null);
  const [deepLoadingQuery, setDeepLoadingQuery] = useState<string | null>(null);
  const [deepError, setDeepError] = useState<{
    query: string;
    message: string;
  } | null>(null);
  const searchRequest = useRef(0);
  const searchOpenRef = useRef(false);
  const {
    library: local,
    ready: localReady,
    toggleSave,
    remember,
    clear,
  } = useLibrary(data);
  const [selected, setSelected] = useState<Item | null>(null);
  const [downloading, setDownloading] = useState(false);
  const demo = data.mode === "demo";
  const suffix = demo ? "?demo=1" : "";
  const resetSearchState = useCallback(() => {
    searchRequest.current++;
    setSearchQuery("");
    setDeep(null);
    setDeepLoadingQuery(null);
    setDeepError(null);
  }, []);
  const changeSearchOpen = useCallback(
    (open: boolean) => {
      searchOpenRef.current = open;
      if (open) resetSearchState();
      setSearchOpen(open);
    },
    [resetSearchState],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        changeSearchOpen(!searchOpenRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [changeSearchOpen]);
  function openItem(item: Item) {
    const onPage = data.page.items.some(
      (pageItem) => itemKey(pageItem) === itemKey(item),
    );
    const enriched =
      item.context || view !== "browse" || !onPage
        ? item
        : { ...item, context: data.page.title };
    changeSearchOpen(false);
    if (!enriched.available) {
      setSelected(enriched);
      return;
    }
    remember(enriched);
    if (isNavigableItem(enriched)) router.push(itemHref(enriched, demo));
    else setSelected(enriched);
  }
  async function download(item: Item) {
    setDownloading(true);
    try {
      await downloadFile(itemHref(item, demo), item.title);
      toast.success("Download ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  }
  async function runDeepSearch() {
    const term = searchQuery.trim();
    if (term.length < 2) return;
    const request = ++searchRequest.current;
    setDeepLoadingQuery(term);
    setDeepError(null);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(term)}${demo ? "&demo=1" : ""}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        error?: string;
        results?: Item[];
        sourceUrl?: string;
        hasMore?: boolean;
      };
      if (!response.ok)
        throw new Error(body.error || "ILIAS search failed.");
      if (request !== searchRequest.current) return;
      setDeep({
        query: term,
        results: Array.isArray(body.results) ? body.results : [],
        sourceUrl: body.sourceUrl || data.page.sourceUrl,
        hasMore: Boolean(body.hasMore),
      });
    } catch (error) {
      if (request === searchRequest.current)
        setDeepError({
          query: term,
          message:
            error instanceof Error ? error.message : "ILIAS search failed.",
        });
    } finally {
      if (request === searchRequest.current) setDeepLoadingQuery(null);
    }
  }
  const pageItems = useMemo(
    () =>
      view === "browse"
        ? data.page.items.map((item) =>
            item.context ? item : { ...item, context: data.page.title },
          )
        : data.page.items,
    [data.page.items, data.page.title, view],
  );
  const allItems = useMemo(
    () => mergeItems(pageItems, local.saved, local.recent),
    [pageItems, local],
  );
  const normalizedFilter = query.toLowerCase();
  const items = (view === "saved" ? local.saved : pageItems).filter((item) =>
    `${item.title} ${item.description} ${item.meta} ${item.context || ""}`
      .toLowerCase()
      .includes(normalizedFilter),
  );
  const courses = items.filter(
    (item) => item.type === "crs" || item.type === "grp",
  );
  const rest = items.filter(
    (item) => item.type !== "crs" && item.type !== "grp",
  );
  const unsupported = pageItems.filter(
    (item) => !isSupportedItemType(item.type),
  );
  const trimmedQuery = searchQuery.trim();
  const localSearchResults = useMemo(() => {
    const terms = trimmedQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = terms.length
      ? allItems.filter((item) => searchMatches(item, terms))
      : mergeItems(local.recent, pageItems);
    return matches.slice(0, 16);
  }, [allItems, local.recent, pageItems, trimmedQuery]);
  const deepForQuery = deep?.query === trimmedQuery ? deep : null;
  const localKeys = new Set(localSearchResults.map(itemKey));
  const deepContext = new Map<string, string>();
  for (const item of deepForQuery?.results || [])
    if (item.context) deepContext.set(itemKey(item), item.context);
  const localResults = localSearchResults.map((item) => {
    const context = item.context || deepContext.get(itemKey(item));
    return context && !item.context ? { ...item, context } : item;
  });
  const deepResults =
    deepForQuery?.results.filter((item) => !localKeys.has(itemKey(item))) || [];
  const deepLoading = deepLoadingQuery === trimmedQuery;
  const currentDeepError =
    deepError?.query === trimmedQuery ? deepError.message : "";
  const navigationResults = [
    {
      title: "Overview",
      icon: Home,
      href: "/",
    },
    {
      title: "My courses",
      icon: GraduationCap,
      href: "/courses",
    },
    {
      title: "Saved for later",
      icon: Bookmark,
      href: "/saved",
    },
    {
      title: "Features & connection",
      icon: Settings2,
      href: "/settings",
    },
  ].filter(
    (entry) =>
      !trimmedQuery ||
      entry.title.toLowerCase().includes(trimmedQuery.toLowerCase()),
  );
  const source = data.page.sourceUrl;
  const itemListProps = {
    layout,
    saved: local.saved,
    demo,
    onOpen: openItem,
    onVisit: remember,
    onToggleSave: toggleSave,
  };
  function nothing(
    title = "Nothing here yet",
    description = "When your ILIAS space has content, it will appear here.",
  ) {
    return (
      <Empty className="min-h-48 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {view !== "saved" && data.mode === "live" && (
          <EmptyContent>
            <OriginalLink href={source}>Check in ILIAS</OriginalLink>
          </EmptyContent>
        )}
      </Empty>
    );
  }
  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <Navigation
        data={data}
        view={view}
        openSearch={() => changeSearchOpen(true)}
        connect={() => setConnectOpen(true)}
      />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between gap-4 border-b px-5 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <span className="text-sm text-muted-foreground">Workspace</span>
            <ChevronRight className="size-3 text-muted-foreground" />
            <span className="truncate text-sm font-medium">
              {view === "home"
                ? "Overview"
                : view === "saved"
                  ? "Saved for later"
                  : view === "courses"
                    ? "Courses"
                    : view === "settings"
                      ? "Features & connection"
                      : data.page.title}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Quick search"
              onClick={() => changeSearchOpen(true)}
            >
              <Search />
            </Button>
            {data.mode === "disconnected" ? (
              <Button size="sm" onClick={() => setConnectOpen(true)}>
                Connect account
                <ArrowUpRight data-icon="inline-end" />
              </Button>
            ) : demo ? (
              <Badge variant="secondary">Demo workspace</Badge>
            ) : null}
          </div>
        </header>
        <div
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 lg:px-10 lg:py-10"
        >
          {demo && (
            <Alert>
              <Sparkles />
              <AlertTitle>You’re exploring a demo</AlertTitle>
              <AlertDescription>
                <span>These courses and materials are examples. </span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setConnectOpen(true)}
                >
                  Connect your account
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {(view === "forum" || view === "exercise") &&
          data.mode !== "disconnected" ? (
            <>
              <ParsedHtmlNotice
                feature={view === "exercise" ? "exercise" : "forum"}
                sourceUrl={demo ? data.instance : source}
                demo={demo}
              />
              {data.error ? (
                <Alert variant="destructive">
                  <CircleHelp />
                  <AlertTitle>
                    {view === "exercise"
                      ? "Couldn’t load this exercise"
                      : "Couldn’t load this discussion"}
                  </AlertTitle>
                  <AlertDescription>
                    {data.error}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setConnectOpen(true)}
                      >
                        Reconnect account
                      </Button>
                      <OriginalLink href={data.page.sourceUrl} />
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                children
              )}
            </>
          ) : view === "settings" ? (
            <SettingsView
              data={data}
              onConnect={() => setConnectOpen(true)}
              onClearHistory={clear}
            />
          ) : data.mode === "disconnected" ? (
            <>
              <section className="welcome-hero relative overflow-hidden rounded-2xl border bg-card px-6 py-10 sm:px-10 sm:py-14">
                <div className="relative z-10 max-w-lg">
                  <Badge variant="outline" className="mb-6">
                    <span className="size-1.5 rounded-full bg-primary" />
                    MADE FOR YOUR LEARNING
                  </Badge>
                  <h1 className="hero-title">
                    Less friction.
                    <br />
                    <span className="text-primary">More learning.</span>
                  </h1>
                  <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                    A calmer home for your ILIAS courses. Find your materials,
                    pick up where you left off, and get on with learning.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button size="lg" onClick={() => setConnectOpen(true)}>
                      Connect your ILIAS
                      <ArrowUpRight data-icon="inline-end" />
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <Link prefetch={true} href="/?demo=1">
                        Take a look around
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  </div>
                  <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5" />
                    Sign in securely through your university.
                  </p>
                </div>
                <div className="hero-art hidden lg:block" aria-hidden="true">
                  <div className="art-orbit orbit-one" />
                  <div className="art-orbit orbit-two" />
                  <div className="art-orbit orbit-three" />
                  <div className="art-book">
                    <BookOpen className="size-14" />
                    <span>
                      A little more
                      <br />
                      room to learn.
                    </span>
                  </div>
                  <span className="art-star star-one">✳</span>
                  <span className="art-star star-two">✳</span>
                  <span className="art-dot" />
                </div>
              </section>
              <div className="grid gap-6 md:grid-cols-3">
                {[
                  {
                    icon: GraduationCap,
                    title: "Your courses, together",
                    text: "One clear starting point for the spaces and materials you use every day.",
                  },
                  {
                    icon: Bookmark,
                    title: "Keep the useful things close",
                    text: "Save a lecture, a folder, or a reading. Come back without retracing your steps.",
                  },
                  {
                    icon: ArrowUpRight,
                    title: "The whole campus is still there",
                    text: "When a feature needs ILIAS, you’ll see it here with a direct way to open it.",
                  },
                ].map(({ icon: Icon, title, text }) => (
                  <Card key={title}>
                    <CardHeader>
                      <Icon className="mb-3 size-5 text-primary" />
                      <CardTitle>{title}</CardTitle>
                      <CardDescription className="leading-relaxed">
                        {text}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3">
                  <University className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Ready for the University of Freiburg
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Works with your existing ILIAS account and myLogin.
                    </p>
                  </div>
                </div>
                <Button variant="link" asChild>
                  <Link prefetch={true} href="/settings">
                    See supported features
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              {view === "browse" && (
                <Button
                  variant="ghost"
                  className="w-fit"
                  onClick={() => {
                    if (window.history.length > 1) router.back();
                    else router.push(`/${suffix}`);
                  }}
                >
                  <ArrowLeft data-icon="inline-start" />
                  Back to your space
                </Button>
              )}
              {view === "home" ? (
                <h1 className="sr-only">Overview</h1>
              ) : (
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div className="max-w-2xl">
                    {(view === "saved" || view === "courses") && (
                      <p className="eyebrow">
                        {view === "saved"
                          ? "THE GOOD STUFF, WITHIN REACH"
                          : "EVERY COURSE, ONE PLACE"}
                      </p>
                    )}
                    <h1 className="page-title mt-3">
                      {view === "saved"
                        ? "Saved for later."
                        : view === "browse"
                          ? data.page.title
                          : view === "courses"
                            ? "Your courses."
                            : "Overview"}
                    </h1>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {view === "saved"
                        ? "The courses and materials you’ve kept close. Saved only in this browser."
                        : view === "browse"
                          ? data.page.description ||
                            "Everything in this space, with a clearer way through."
                          : view === "courses"
                            ? "Every course and group from your ILIAS dashboard, with a clearer way in."
                            : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {view !== "saved" && <RefreshButton />}
                  </div>
                </div>
              )}
              {view !== "saved" && view !== "browse" && (
                <ParsedHtmlNotice
                  compact
                  feature="dashboard"
                  sourceUrl={demo ? data.instance : source}
                  demo={demo}
                />
              )}
              {data.error ? (
                <>
                  <Alert variant="destructive">
                    <CircleHelp />
                    <AlertTitle>Couldn’t load this learning space</AlertTitle>
                    <AlertDescription>
                      {data.error}
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setConnectOpen(true)}
                        >
                          Reconnect account
                        </Button>
                        <OriginalLink href={source} />
                      </div>
                    </AlertDescription>
                  </Alert>
                  {view === "browse" && (
                    <ParsedHtmlNotice
                      compact
                      feature="materials"
                      sourceUrl={demo ? data.instance : source}
                      demo={demo}
                    />
                  )}
                </>
              ) : (
                <>
                  {data.page.notices.map((notice, i) => (
                    <Alert key={i}>
                      <CircleHelp />
                      <AlertDescription>{notice}</AlertDescription>
                    </Alert>
                  ))}
                  {view === "home" &&
                    localReady &&
                    local.recent.length > 0 && (
                      <section className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <h2 className="section-title">
                            Pick up where you left off
                          </h2>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {local.recent.slice(0, 2).map((item) => (
                            <Card key={itemKey(item)} size="sm">
                              <CardHeader>
                                <CardTitle>
                                  <ItemAction
                                    variant="link"
                                    className="resource-title"
                                    item={item}
                                    demo={demo}
                                    onOpen={openItem}
                                    onVisit={remember}
                                  >
                                    {item.title}
                                  </ItemAction>
                                </CardTitle>
                                <CardDescription>
                                  {item.context ||
                                    typeNames[item.type] ||
                                    "ILIAS object"}
                                </CardDescription>
                                <CardAction>
                                  <ItemAction
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Continue ${item.title}`}
                                    item={item}
                                    demo={demo}
                                    onOpen={openItem}
                                    onVisit={remember}
                                  >
                                    <ArrowUpRight />
                                  </ItemAction>
                                </CardAction>
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      </section>
                    )}
                  {view === "browse" &&
                    (data.page.tools.length > 1 || unsupported.length > 0) && (
                      <Alert>
                        <ArrowUpRight />
                        <AlertTitle>This course has more in ILIAS</AlertTitle>
                        <AlertDescription>
                          Interactive activities and course tools open in the
                          original platform. They’re labeled “In ILIAS” below.
                        </AlertDescription>
                      </Alert>
                    )}
                  {view === "browse" && (
                    <Tabs defaultValue="materials">
                      <TabsList>
                        <TabsTrigger value="materials">
                          Materials{" "}
                          <Badge variant="secondary">
                            {pageItems.length}
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="information">
                          Course information
                        </TabsTrigger>
                        <TabsTrigger value="tools">
                          ILIAS tools <ArrowUpRight />
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="information" className="mt-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>From your course page</CardTitle>
                            <CardDescription>
                              HTML-based: introductory text is extracted from
                              ILIAS. Changes to its layout can omit content.
                              Open the original for links, media, and the full
                              layout.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="flex flex-col gap-4">
                            {data.page.text.length ? (
                              data.page.text.map((p, i) => (
                                <p
                                  key={i}
                                  className="text-sm leading-relaxed text-muted-foreground"
                                >
                                  {p}
                                </p>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No introductory text was found on this page.
                              </p>
                            )}
                          </CardContent>
                          <CardFooter>
                            <OriginalLink href={source} />
                          </CardFooter>
                        </Card>
                      </TabsContent>
                      <TabsContent value="tools" className="mt-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>
                              Keep the full course within reach
                            </CardTitle>
                            <CardDescription>
                              HTML-based: these links are extracted from the
                              course page and may be incomplete after an ILIAS
                              update. Each opens the original interface.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="flex flex-wrap gap-3">
                            {data.page.tools.map((tool) => (
                              <OriginalLink
                                key={tool.title}
                                href={demo ? data.instance : tool.url}
                              >
                                {tool.title}
                              </OriginalLink>
                            ))}
                            {!data.page.tools.length && (
                              <OriginalLink href={source} />
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>
                      <TabsContent value="materials" className="mt-6">
                        <div className="mb-5 max-w-md">
                          <InputGroup>
                            <InputGroupAddon>
                              <Search />
                            </InputGroupAddon>
                            <InputGroupInput
                              placeholder="Find something in this space…"
                              aria-label="Filter materials"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                            />
                          </InputGroup>
                        </div>
                        {items.length ? (
                          <ItemList {...itemListProps} items={items} />
                        ) : (
                          nothing(
                            query
                              ? "No matching materials"
                              : "No materials found",
                            query
                              ? "Try a different word or clear the filter."
                              : "This space may be empty, restricted, or use a layout Achilias cannot read yet. Check the original ILIAS page.",
                          )
                        )}
                      </TabsContent>
                    </Tabs>
                  )}
                  {view !== "browse" && (
                    <section className="flex flex-col gap-5" id="courses">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          {view === "home" ? (
                            <h2 className="section-title">
                              <Link
                                prefetch={demo}
                                href={`/courses${suffix}`}
                                className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
                              >
                                Your courses
                                <ArrowRight
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </Link>
                            </h2>
                          ) : (
                            <h2 className="section-title">
                              {view === "saved"
                                ? "Your saved items"
                                : "Your courses"}
                            </h2>
                          )}
                          <Badge variant="secondary">
                            {view === "saved" ? items.length : courses.length}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {view === "home" && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link prefetch={demo} href={`/courses${suffix}`}>
                                All courses
                                <ArrowRight data-icon="inline-end" />
                              </Link>
                            </Button>
                          )}
                          {view === "home" && <RefreshButton />}
                          <div className="w-44 sm:w-56">
                            <InputGroup>
                              <InputGroupAddon>
                                <Search />
                              </InputGroupAddon>
                              <InputGroupInput
                                aria-label="Filter courses and materials"
                                placeholder={
                                  view === "saved"
                                    ? "Find a saved item…"
                                    : "Find a course or group…"
                                }
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                              />
                            </InputGroup>
                          </div>
                          <ToggleGroup
                            type="single"
                            value={layout}
                            onValueChange={(v) => v && setLayout(v)}
                            variant="outline"
                            spacing={0}
                            aria-label="Content layout"
                          >
                            <ToggleGroupItem
                              value="grid"
                              aria-label="Grid view"
                            >
                              <LayoutGrid />
                            </ToggleGroupItem>
                            <ToggleGroupItem
                              value="list"
                              aria-label="List view"
                            >
                              <List />
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                      </div>
                      {view === "saved" ? (
                        items.length ? (
                          <ItemList {...itemListProps} items={items} />
                        ) : (
                          nothing(
                            query
                              ? "No matching saved items"
                              : "Make a little space for later",
                            query
                              ? "Try a different search."
                              : "Use the bookmark beside any course or material to save it here.",
                          )
                        )
                      ) : courses.length ? (
                        <ItemList {...itemListProps} items={courses} grid />
                      ) : (
                        nothing(
                          query
                            ? "No matching courses"
                            : "Your courses will appear here",
                          query
                            ? "Try a different search."
                            : "Achilias shows course and group links from your ILIAS dashboard. Add courses to your dashboard in ILIAS if they’re missing here.",
                        )
                      )}
                    </section>
                  )}
                  {view === "home" && rest.length > 0 && (
                    <section className="flex flex-col gap-5">
                      <h2 className="section-title">
                        Also in your learning space
                      </h2>
                      <ItemList {...itemListProps} items={rest} />
                    </section>
                  )}
                  {data.page.hasMore && (
                    <Alert>
                      <CircleHelp />
                      <AlertTitle>
                        There may be more on the original page
                      </AlertTitle>
                      <AlertDescription>
                        This ILIAS listing has pagination. Achilias currently
                        shows the first page.
                        <div className="mt-2">
                          <OriginalLink href={source}>
                            View all in ILIAS
                          </OriginalLink>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  {view === "home" && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ArrowUpRight className="size-4 text-primary" />
                          Still connected to the whole campus.
                        </CardTitle>
                        <CardDescription>
                          Quizzes, mail, and your calendar are available in
                          ILIAS. Exercises and forums open here; advanced
                          activities have a clear handoff.
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="justify-between">
                        <Button variant="link" asChild>
                          <Link prefetch={true} href={`/settings${suffix}`}>
                            What’s supported
                            <ArrowRight data-icon="inline-end" />
                          </Link>
                        </Button>
                        <OriginalLink href={data.instance} compact>
                          Go to ILIAS
                        </OriginalLink>
                      </CardFooter>
                    </Card>
                  )}
                  {view === "browse" && (
                    <ParsedHtmlNotice
                      compact
                      feature="materials"
                      sourceUrl={demo ? data.instance : source}
                      demo={demo}
                    />
                  )}
                </>
              )}
            </>
          )}
          <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground">
            <span>A calmer way to ILIAS.</span>
            <span>
              Independent frontend ·{" "}
              {data.fetchedAt
                ? `Fetched ${new Date(data.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} Berlin time`
                : demo
                  ? "Example content, real possibilities."
                  : "Built for the everyday."}
            </span>
          </footer>
        </div>
      </SidebarInset>
      <CommandDialog
        open={searchOpen}
        onOpenChange={changeSearchOpen}
        title="Find a course or material"
        description="Search this page, saved items, recent history, and all your courses in ILIAS."
        className="top-1/2 h-[min(88svh,52rem)] max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] -translate-y-1/2 gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <Command shouldFilter={false} className="h-auto min-h-0 flex-1">
          <CommandInput
            placeholder="Search courses, groups, folders, and materials…"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="min-h-0 flex-1 max-h-none">
            {navigationResults.length > 0 && (
              <CommandGroup heading="Navigate">
                {navigationResults.map(({ title, icon: Icon, href }) => (
                  <CommandItem
                    key={href}
                    value={href}
                    onSelect={() => {
                      changeSearchOpen(false);
                      router.push(`${href}${suffix}`);
                    }}
                  >
                    <Icon />
                    {title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {localResults.length > 0 && (
              <CommandGroup
                heading={
                  trimmedQuery
                    ? "On this page, saved & recent"
                    : "Recent & on this page"
                }
              >
                {localResults.map((item) => (
                  <SearchResultOption
                    key={itemKey(item)}
                    item={item}
                    onSelect={openItem}
                  />
                ))}
              </CommandGroup>
            )}
            {trimmedQuery && !localResults.length && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No match in this page, saved items, or recent history.
              </div>
            )}
            {trimmedQuery &&
              (deepForQuery && deepResults.length > 0 ? (
                <CommandGroup heading="Other matches in ILIAS">
                  {deepResults.map((item) => (
                    <SearchResultOption
                      key={itemKey(item)}
                      item={item}
                      onSelect={openItem}
                    />
                  ))}
                  {deepForQuery.hasMore && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Showing the first matches. Open ILIAS search for the rest.
                    </div>
                  )}
                </CommandGroup>
              ) : (
                <CommandGroup heading="All your courses">
                  {data.mode === "disconnected" ? (
                    <CommandItem
                      value="connect-to-search"
                      onSelect={() => {
                        changeSearchOpen(false);
                        setConnectOpen(true);
                      }}
                    >
                      <ShieldCheck />
                      Connect your account to search all your courses
                    </CommandItem>
                  ) : trimmedQuery.length < 2 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">
                      Keep typing to search all your courses in ILIAS.
                    </div>
                  ) : deepLoading ? (
                    <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                      <Loader2 className="animate-spin" />
                      Searching all your courses…
                    </div>
                  ) : currentDeepError ? (
                    <>
                      <div className="px-3 py-3 text-sm text-destructive">
                        {currentDeepError}
                      </div>
                      <CommandItem
                        value="retry-deep-search"
                        onSelect={runDeepSearch}
                      >
                        <Search />
                        Try again
                      </CommandItem>
                    </>
                  ) : deepForQuery ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">
                      {deepForQuery.results.length
                        ? "All matches are already shown above."
                        : `No matches for “${deepForQuery.query}” in ILIAS.`}
                      <a
                        href={deepForQuery.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 font-medium text-foreground underline underline-offset-3"
                      >
                        Open the search in ILIAS
                      </a>
                    </div>
                  ) : (
                    <CommandItem value="search-all" onSelect={runDeepSearch}>
                      <Search />
                      Search all your courses for “{trimmedQuery}”
                      <span className="ml-auto text-xs text-muted-foreground">
                        ILIAS
                      </span>
                    </CommandItem>
                  )}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span>
            {data.mode === "disconnected"
              ? "Local search works now. Connect to search the whole repository."
              : "Local results are instant. Deeper results come from ILIAS search."}
          </span>
          {deepForQuery && (
            <a
              href={deepForQuery.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-3"
            >
              Open this search in ILIAS
              <ArrowUpRight className="size-3.5" />
            </a>
          )}
        </div>
      </CommandDialog>
      <ConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        instance={data.instance}
      />
      <Dialog
        open={!!selected}
        onOpenChange={(value) => {
          if (!value) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <Badge variant="secondary" className="mb-2 w-fit">
              {selected && (typeNames[selected.type] || "ILIAS object")}
            </Badge>
            {selected?.context && (
              <p className="text-xs text-muted-foreground">
                {selected.context}
              </p>
            )}
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>
              {selected?.description ||
                "This item is part of your ILIAS learning space."}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-muted-foreground">
                {!selected.available
                  ? "ILIAS has restricted this object or it is not currently available. Check the original page for access requirements."
                  : selected.type === "file"
                    ? selected.meta ||
                      "Download using your connected ILIAS session."
                    : demo
                      ? "This is an example activity. In a connected account, the original ILIAS activity opens here."
                      : `This ${typeNames[selected.type]?.toLowerCase() || "activity"} is not implemented in Achilias yet. Open ILIAS to use the full feature. Your work stays on the original platform.`}
              </p>
              <ParsedHtmlNotice
                feature="item"
                sourceUrl={demo ? data.instance : selected.sourceUrl}
                demo={demo}
              />
              <div className="flex flex-wrap gap-2">
                {selected.type === "file" && selected.available && (
                  <Button
                    onClick={() => download(selected)}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <ArrowDownToLine data-icon="inline-start" />
                    )}
                    {downloading
                      ? "Preparing download"
                      : demo
                        ? "Download example PDF"
                        : "Download file"}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => toggleSave(selected)}>
                  <Bookmark data-icon="inline-start" />
                  {local.saved.some((i) => itemKey(i) === itemKey(selected))
                    ? "Unsave"
                    : "Save for later"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
