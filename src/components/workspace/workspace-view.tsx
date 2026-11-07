"use client";
import type { WorkspaceViewName } from "./navigation";
import { useWorkspaceShell } from "./workspace-shell";
import { SettingsView } from "./settings-view";
import { ItemList } from "./item-list";
import { QuickSearch } from "./quick-search";
import { ItemDialog } from "./item-dialog";
import { DisconnectedView } from "./disconnected-view";
import { PageHeading } from "./page-heading";
import { BrowseTabs } from "./browse-tabs";
import { LibrarySection } from "./library-section";
import { EmptyState } from "./empty-state";
import { LoadErrorAlert } from "./error-alert";
import { crumbFor, demoHref } from "./nav-items";
import { parentCrumb, workspaceCrumbs } from "@/lib/ilias/breadcrumbs";
import type { ItemListProps } from "./item-list";
import { useLibrary } from "@/hooks/use-library";
import { mergeItems } from "@/lib/ilias/library";
import {
  isExternalItem,
  isFileItem,
  itemOpenHref,
  isSupportedItemType,
  isNavigableItem,
  itemKey,
  itemHref,
  typeNames,
} from "@/lib/ilias/items";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  Home,
  LayoutDashboard,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ItemAction } from "@/components/navigation/item-action";
import { ParsedHtmlNotice } from "@/components/navigation/parsed-html-notice";
import { OriginalLink } from "@/components/navigation/original-link";
import type { Item, Workspace } from "@/lib/ilias/types";

export function WorkspaceView({
  data,
  view = "home",
  objectType,
  children,
}: {
  children?: React.ReactNode;
  data: Workspace;
  objectType?: string;
  view?: WorkspaceViewName;
}) {
  const router = useRouter();
  const { searchOpen, setSearchOpen, setConnectOpen } = useWorkspaceShell();
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState("grid");
  const {
    library: local,
    ready: localReady,
    toggleSave,
    remember,
    clear,
  } = useLibrary(data);
  const [selected, setSelected] = useState<Item | null>(null);
  const demo = data.mode === "demo";
  const crumbs =
    view === "browse" || view === "forum" || view === "exercise"
      ? workspaceCrumbs(data.page, demo)
      : [];
  const parent = parentCrumb(crumbs);
  useEffect(() => {
    if (data.mode === "disconnected") return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data.mode, setSearchOpen]);
  function contextualItem(item: Item) {
    const onPage = data.page.items.some(
      (pageItem) => itemKey(pageItem) === itemKey(item),
    );
    return item.context || view !== "browse" || !onPage
      ? item
      : { ...item, context: data.page.title };
  }
  function rememberItem(item: Item) {
    remember(contextualItem(item));
  }
  function openItem(item: Item) {
    const enriched = contextualItem(item);
    setSearchOpen(false);
    if (!enriched.available) {
      setSelected(enriched);
      return;
    }
    remember(enriched);
    if (isExternalItem(enriched) || isFileItem(enriched)) {
      window.open(
        itemOpenHref(enriched, demo),
        "_blank",
        "noopener,noreferrer",
      );
    } else if (isNavigableItem(enriched)) {
      router.push(itemHref(enriched, demo));
    } else {
      setSelected(enriched);
    }
  }
  const pageItems = useMemo(
    () =>
      view === "browse"
        ? data.page.items.map((item) =>
            item.context === data.page.title
              ? { ...item, context: undefined }
              : item,
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
  const source = data.page.sourceUrl;
  const itemListProps: ItemListProps = {
    layout,
    saved: local.saved,
    demo,
    onOpen: openItem,
    onVisit: rememberItem,
    onToggleSave: toggleSave,
  };
  const renderEmpty = (
    title = "No items found",
    description = "Check the original ILIAS page if you expected items.",
  ) => (
    <EmptyState
      title={title}
      description={description}
      showOriginal={view !== "saved" && data.mode === "live"}
      sourceUrl={source}
    />
  );
  if (data.mode === "disconnected")
    return (
      <DisconnectedView data={data} view={view} onClearHistory={clear} />
    );
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between gap-4 border-b px-5 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex min-w-0 items-center gap-3">
                <li className="flex items-center gap-3">
                  <LayoutDashboard
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Link
                    prefetch={demo}
                    href={demoHref("/", demo)}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Workspace
                  </Link>
                </li>
                {crumbs.length ? (
                  crumbs.map((crumb, index) => {
                    const current = index === crumbs.length - 1;
                    return (
                      <li
                        key={`${crumb.title}-${index}`}
                        aria-current={current ? "page" : undefined}
                        className="flex min-w-0 items-center gap-3"
                      >
                        <ChevronRight
                          className="size-3 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        {index === 0 && (
                          <GraduationCap
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                        {current || !crumb.href ? (
                          <span
                            className={`truncate text-sm ${current ? "font-medium" : "text-muted-foreground"}`}
                          >
                            {crumb.title}
                          </span>
                        ) : (
                          <Link
                            prefetch={demo}
                            href={crumb.href}
                            className="truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {crumb.title}
                          </Link>
                        )}
                      </li>
                    );
                  })
                ) : (
                  <>
                    <li aria-hidden="true" className="flex items-center">
                      <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                    </li>
                    <li
                      aria-current="page"
                      className="flex min-w-0 items-center gap-3"
                    >
                      {view === "home" ? (
                        <Home
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : view === "saved" ? (
                        <Bookmark
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : view === "settings" ? (
                        <Settings2
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : (
                        <GraduationCap
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate text-sm font-medium">
                        {crumbFor(view, data.page.title)}
                      </span>
                    </li>
                  </>
                )}
              </ol>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Quick search"
              onClick={() => setSearchOpen(true)}
            >
              <Search />
            </Button>
            {demo ? <Badge variant="secondary">Demo workspace</Badge> : null}
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
                  Sign in
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {view === "forum" || view === "exercise" ? (
            <>
              {data.error ? (
                <LoadErrorAlert
                  title={
                    view === "exercise"
                      ? "Couldn’t load this exercise"
                      : "Couldn’t load this discussion"
                  }
                  error={data.error}
                  onConnect={() => setConnectOpen(true)}
                  sourceUrl={data.page.sourceUrl}
                />
              ) : (
                children
              )}
              <ParsedHtmlNotice
                feature={view === "exercise" ? "exercise" : "forum"}
                sourceUrl={demo ? data.instance : source}
                demo={demo}
              />
            </>
          ) : view === "settings" ? (
            <SettingsView
              data={data}
              onConnect={() => setConnectOpen(true)}
              onClearHistory={clear}
            />
          ) : (
            <>
              {view === "browse" && parent?.href && (
                <Button variant="ghost" className="w-fit" asChild>
                  <Link prefetch={demo} href={parent.href}>
                    <ArrowLeft data-icon="inline-start" />
                    Back to {parent.title}
                  </Link>
                </Button>
              )}
              {view === "home" ? (
                <h1 className="sr-only">Overview</h1>
              ) : (
                <PageHeading
                  view={view as "browse" | "saved" | "courses"}
                  data={data}
                />
              )}
              {data.error ? (
                <>
                  <LoadErrorAlert
                    title={
                      data.unavailable
                        ? "This learning space isn’t available to you"
                        : "Couldn’t load this learning space"
                    }
                    error={data.error}
                    onConnect={
                      data.unavailable
                        ? undefined
                        : () => setConnectOpen(true)
                    }
                    sourceUrl={source}
                  />
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
                  {view === "home" && localReady && local.recent.length > 0 && (
                    <section className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <h2 className="section-title">Recently opened</h2>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {local.recent.slice(0, 2).map((item) => (
                          <Card
                            key={itemKey(item)}
                            size="sm"
                            className="relative"
                          >
                            <CardHeader>
                              <CardTitle>
                                <ItemAction
                                  variant="link"
                                  className="resource-title px-0 after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                                  item={item}
                                  demo={demo}
                                  onOpen={openItem}
                                  onVisit={rememberItem}
                                >
                                  {item.title}
                                </ItemAction>
                              </CardTitle>
                              <CardDescription>
                                {item.context ||
                                  typeNames[item.type] ||
                                  "ILIAS object"}
                              </CardDescription>
                              <CardAction className="relative z-10">
                                <ItemAction
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Continue ${item.title}`}
                                  item={item}
                                  demo={demo}
                                  onOpen={openItem}
                                  onVisit={rememberItem}
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
                  {view === "browse" && (
                    <BrowseTabs
                      data={data}
                      demo={demo}
                      source={source}
                      query={query}
                      onQueryChange={setQuery}
                      items={items}
                      total={pageItems.length}
                      itemProps={itemListProps}
                      layout={layout}
                      onLayoutChange={setLayout}
                      empty={renderEmpty}
                      objectType={objectType}
                    />
                  )}
                  {view !== "browse" && (
                    <LibrarySection
                      view={view as "home" | "saved" | "courses"}
                      demo={demo}
                      items={items}
                      courses={courses}
                      query={query}
                      onQueryChange={setQuery}
                      layout={layout}
                      onLayoutChange={setLayout}
                      itemProps={itemListProps}
                      empty={renderEmpty}
                    />
                  )}
                  {view === "home" && rest.length > 0 && (
                    <section className="flex flex-col gap-5">
                      <h2 className="section-title">Other items</h2>
                      <ItemList {...itemListProps} items={rest} />
                    </section>
                  )}
                  {data.page.notices.map((notice, i) => (
                    <Alert key={i}>
                      <CircleHelp />
                      <AlertDescription>{notice}</AlertDescription>
                    </Alert>
                  ))}
                  {view === "browse" &&
                    (data.page.tools.length > 1 || unsupported.length > 0) && (
                      <Alert>
                        <ArrowUpRight />
                        <AlertTitle>This course has more in ILIAS</AlertTitle>
                        <AlertDescription>
                          Unsupported activities and additional course tools
                          open in ILIAS.
                        </AlertDescription>
                      </Alert>
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
                          Tools available in ILIAS
                        </CardTitle>
                        <CardDescription>
                          Use ILIAS for quizzes, mail and calendar.
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="justify-between">
                        <Button variant="link" asChild>
                          <Link
                            prefetch={true}
                            href={demoHref("/settings", demo)}
                          >
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
              {/* The parser notice is the escape hatch, so it also stays on
                  pages that failed to load. */}
              {view !== "saved" && view !== "browse" && (
                <ParsedHtmlNotice
                  compact
                  feature="dashboard"
                  sourceUrl={demo ? data.instance : source}
                  demo={demo}
                />
              )}
            </>
          )}
          <footer className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t pt-6 text-xs text-muted-foreground">
            <span>
              Achilias
              {data.fetchedAt
                ? ` · Fetched ${new Date(data.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} Berlin time`
                : demo
                  ? " · Demo data"
                  : ""}
            </span>
          </footer>
        </div>
      </SidebarInset>
      <QuickSearch
        data={data}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onOpenItem={openItem}
        onConnect={() => setConnectOpen(true)}
        allItems={allItems}
        recent={local.recent}
        saved={local.saved}
        pageItems={pageItems}
      />
      <ItemDialog
        item={selected}
        onClose={() => setSelected(null)}
        demo={demo}
        instance={data.instance}
        saved={local.saved}
        onToggleSave={toggleSave}
      />
    </>
  );
}
