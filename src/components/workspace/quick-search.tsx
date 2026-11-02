"use client";
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { iconFor } from "./item-icon";
import { demoHref, settingsEntry, workspaceNav } from "./nav-items";
import { readSearchStream } from "@/lib/ilias/search-stream";
import { mergeItems } from "@/lib/ilias/library";
import {
  matchesItem,
  isInsideCourses,
  rankByFamiliarity,
  rankByTitle,
  searchTerms,
} from "@/lib/ilias/item-search";
import { itemKey, typeNames } from "@/lib/ilias/items";
import type { Item, Workspace } from "@/lib/ilias/types";

type DeepSearch = {
  query: string;
  account: string;
  scopedKeys: string[];
  results: Item[];
  sourceUrl: string;
  hasMore: boolean;
  page: number;
};

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

/**
 * The Cmd/Ctrl+K palette: instant local matches plus ILIAS' repository search.
 * Owns every search state; the shell only toggles `open` and receives picks.
 */
export function QuickSearch({
  data,
  open,
  onOpenChange,
  onOpenItem,
  onConnect,
  allItems,
  recent,
  saved,
  pageItems,
}: {
  allItems: Item[];
  data: Workspace;
  onConnect: () => void;
  onOpenChange: (open: boolean) => void;
  onOpenItem: (item: Item) => void;
  open: boolean;
  pageItems: Item[];
  recent: Item[];
  saved: Item[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const currentRoot = pathname.match(/^\/browse\/(?:crs|grp|fold|cat)\/([1-9]\d{0,11})$/)?.[1];
  const demo = data.mode === "demo";
  const scope = data.storageKey || data.mode;
  const [catalog, setCatalog] = useState<{
    scope: string;
    items: Item[];
    status: "ready" | "error";
    hasMore: boolean;
    error?: string;
  } | null>(null);
  const [discovered, setDiscovered] = useState<{ scope: string; items: Item[] } | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const rememberItems = useCallback((items: Item[]) => {
    setDiscovered((current) => ({ scope, items: mergeItems(items, current?.scope === scope ? current.items : []).slice(0, 4000) }));
  }, [scope]);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [showAllLocal, setShowAllLocal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deep, setDeep] = useState<DeepSearch | null>(null);
  const [deepLoadingQuery, setDeepLoadingQuery] = useState<string | null>(null);
  const [deepStage, setDeepStage] = useState("");
  const [deepError, setDeepError] = useState<{
    query: string;
    account: string;
    message: string;
  } | null>(null);
  const [deepMoreLoading, setDeepMoreLoading] = useState(false);
  const [deepMoreError, setDeepMoreError] = useState("");
  const loadingMore = useRef(false);
  const searchRequest = useRef(0);
  const searchAbort = useRef<AbortController | null>(null);
  const cancelDeepSearch = useCallback(() => {
    searchRequest.current++;
    searchAbort.current?.abort();
  }, []);
  const wasOpen = useRef(false);
  const resetSearchState = () => {
    searchRequest.current++;
    searchAbort.current?.abort();
    searchAbort.current = null;
    setSearchQuery("");
    setShowAllLocal(false);
    setDeep(null);
    setDeepLoadingQuery(null);
    setDeepError(null);
    loadingMore.current = false;
    setDeepMoreLoading(false);
    setDeepMoreError("");
  };
  // Opening the palette starts fresh, however it was opened.
  useEffect(() => {
    if (open && !wasOpen.current) resetSearchState();
    wasOpen.current = open;
  }, [open]);
  // Fetch once per opening, never per keystroke. Closing or changing accounts
  // cancels the request; account-scoped state cannot leak into another session.
  useEffect(() => {
    if (!open || data.mode === "disconnected") return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/search/items${demo ? "?demo=1" : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = (await response.json()) as {
          items?: Item[];
          discovered?: Item[];
          hasMore?: boolean;
          error?: string;
        };
        if (!response.ok)
          throw new Error(body.error || "Could not load your courses.");
        if (!controller.signal.aborted) {
          rememberItems(body.discovered || []);
          setCatalog({
            scope,
            items: Array.isArray(body.items) ? body.items : [],
            status: "ready",
            hasMore: Boolean(body.hasMore),
          });
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setCatalog({
            scope,
            items: [],
            status: "error",
            hasMore: false,
            error: error instanceof Error ? error.message : "Could not load your courses.",
          });
      }
    })();
    return () => controller.abort();
  }, [open, scope, demo, data.mode, catalogRetry, rememberItems]);
  const accountCatalog = catalog?.scope === scope ? catalog : null;
  const catalogItems = useMemo(
    () => accountCatalog?.items || [],
    [accountCatalog],
  );
  const nearbyRoots = [
    ...(currentRoot ? [`${pathname.split("/")[2]}:${currentRoot}`] : []),
    ...mergeItems(recent, catalogItems).filter((item) => ["crs", "grp", "fold", "cat"].includes(item.type)).map(itemKey),
  ].slice(0, 4).join(",");
  // Begin discovery on opening, before the user finishes typing. It is independent
  // of the query: new keystrokes reuse the same incoming folder listings.
  useEffect(() => {
    if (!open || demo || data.mode !== "live") return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    for (const root of nearbyRoots.split(",").filter(Boolean)) params.append("root", root);
    void fetch(`/api/search/nearby?${params}`, { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setNearbyLoading(true);
        setNearbyError("");
        return readSearchStream(response, controller.signal, rememberItems);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setNearbyError(error instanceof Error ? error.message : "Nearby folder search failed.");
      })
      .finally(() => { if (!controller.signal.aborted) setNearbyLoading(false); });
    return () => controller.abort();
  }, [open, demo, data.mode, nearbyRoots, rememberItems]);
  const catalogLoading = data.mode !== "disconnected" && !accountCatalog;
  const runDeepSearch = useCallback(async () => {
    const term = searchQuery.trim();
    if (term.length < 2 || term.length > 200) return;
    const request = ++searchRequest.current;
    // A newer search makes the older ILIAS query useless; cancel it instead of
    // letting several expensive searches run to completion in the background.
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setDeepLoadingQuery(term);
    setDeepError(null);
    setDeepMoreLoading(false);
    setDeepMoreError("");
    let accumulated: Item[] = [];
    let scopedKeys: string[] = [];
    try {
      for (const root of currentRoot ? [currentRoot, undefined] : [undefined]) {
        setDeepStage(root
          ? `Searching ${data.page.title} and its subfolders…`
          : "Searching your courses and the wider ILIAS repository…");
        const params = new URLSearchParams({ q: term });
        if (demo) params.set("demo", "1");
        if (root) params.set("root", root);
        const response = await fetch(`/api/search?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          error?: string;
          results?: Item[];
          sourceUrl?: string;
          hasMore?: boolean;
          page?: number;
        };
        if (request !== searchRequest.current || controller.signal.aborted) return;
        if (!response.ok) {
          // An unavailable container search must not prevent widening.
          if (root && response.status !== 401) continue;
          throw new Error(body.error || "ILIAS search failed.");
        }
        const results = Array.isArray(body.results) ? body.results : [];
        if (root) scopedKeys = results.map(itemKey);
        accumulated = mergeItems(accumulated, results);
        setDeep({
          query: term,
          account: scope,
          scopedKeys,
          results: accumulated,
          sourceUrl: body.sourceUrl || data.page.sourceUrl,
          hasMore: !root && Boolean(body.hasMore),
          page: body.page || 1,
        });
      }
    } catch (error) {
      if (request !== searchRequest.current || controller.signal.aborted) return;
      setDeepError({
        query: term,
        account: scope,
        message:
          error instanceof Error ? error.message : "ILIAS search failed.",
      });
    } finally {
      if (searchAbort.current === controller) searchAbort.current = null;
      if (request === searchRequest.current) setDeepLoadingQuery(null);
    }
  }, [searchQuery, currentRoot, demo, scope, data.page.sourceUrl, data.page.title]);
  // Local results remain instant. Give typing a pause before starting the
  // recursive upstream search, and cancel every stage on close or query change.
  useEffect(() => {
    if (!open || data.mode === "disconnected" || searchQuery.trim().length < 2) return;
    const timer = setTimeout(() => void runDeepSearch(), 450);
    return () => {
      clearTimeout(timer);
      cancelDeepSearch();
    };
  }, [open, data.mode, searchQuery, runDeepSearch, cancelDeepSearch]);
  const trimmedQuery = searchQuery.trim();
  const localSearchResults = useMemo(() => {
    const terms = searchTerms(trimmedQuery);
    const candidates = mergeItems(pageItems, catalogItems, discovered?.scope === scope ? discovered.items : [], allItems);
    return terms.length
      ? rankByTitle(
          candidates.filter((item) => matchesItem(item, terms)),
          trimmedQuery,
        )
      : mergeItems(recent, catalogItems, pageItems, saved);
  }, [allItems, recent, pageItems, saved, catalogItems, trimmedQuery, discovered, scope]);
  const visibleLocalResults = showAllLocal
    ? localSearchResults
    : localSearchResults.slice(0, 16);
  const deepForQuery = deep?.query === trimmedQuery && deep.account === scope ? deep : null;
  // ILIAS pages search results through its own result view, so reaching the
  // bottom of the list asks for the next page instead of sending the user away.
  async function loadMore() {
    if (!deepForQuery || !deepForQuery.hasMore || loadingMore.current) return;
    const term = deepForQuery.query;
    loadingMore.current = true;
    const request = searchRequest.current;
    const controller = new AbortController();
    searchAbort.current?.abort();
    searchAbort.current = controller;
    setDeepMoreLoading(true);
    setDeepMoreError("");
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(term)}&page=${deepForQuery.page + 1}${demo ? "&demo=1" : ""}`,
        { cache: "no-store", signal: controller.signal },
      );
      const body = (await response.json()) as {
        error?: string;
        results?: Item[];
        hasMore?: boolean;
        page?: number;
      };
      if (!response.ok)
        throw new Error(body.error || "Could not load more results.");
      if (request !== searchRequest.current) return;
      setDeep((current) => {
        if (!current || current.query !== term) return current;
        const seen = new Set(current.results.map(itemKey));
        const added = (Array.isArray(body.results) ? body.results : []).filter(
          (item) => {
            if (seen.has(itemKey(item))) return false;
            seen.add(itemKey(item));
            return true;
          },
        );
        return {
          ...current,
          results: [...current.results, ...added],
          page: body.page || current.page + 1,
          hasMore: Boolean(body.hasMore),
        };
      });
    } catch (error) {
      if (request !== searchRequest.current || controller.signal.aborted) return;
      setDeepMoreError(
        error instanceof Error ? error.message : "Could not load more results.",
      );
    } finally {
      if (searchAbort.current === controller) searchAbort.current = null;
      if (request === searchRequest.current) {
        loadingMore.current = false;
        setDeepMoreLoading(false);
      }
    }
  }
  function onListScroll(event: UIEvent<HTMLDivElement>) {
    const list = event.currentTarget;
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 120)
      void loadMore();
  }
  const localKeys = new Set(visibleLocalResults.map(itemKey));
  const deepContext = new Map<string, string>();
  for (const item of deepForQuery?.results || [])
    if (item.context) deepContext.set(itemKey(item), item.context);
  const localResults = visibleLocalResults.map((item) => {
    const context = item.context || deepContext.get(itemKey(item));
    return context && !item.context ? { ...item, context } : item;
  });
  const deepResults = rankByFamiliarity(
    deepForQuery?.results.filter((item) => !localKeys.has(itemKey(item))) || [],
    mergeItems(saved, recent, catalogItems),
  );
  const deepLoading = deepLoadingQuery === trimmedQuery;
  const currentDeepError =
    deepError?.query === trimmedQuery && deepError.account === scope ? deepError.message : "";
  const scopedKeys = new Set(deepForQuery?.scopedKeys);
  const resultGroups: { heading: string; items: Item[] }[] = [
    { heading: `Inside ${data.page.title}`, items: [] },
    { heading: "Inside your courses & groups", items: [] },
    { heading: "Other matches in ILIAS", items: [] },
  ];
  for (const item of deepResults) {
    const group = scopedKeys.has(itemKey(item)) ? 0 : isInsideCourses(item, catalogItems) ? 1 : 2;
    resultGroups[group].items.push(item);
  }
  const navigationResults = [
    ...workspaceNav.map(({ title, icon, href }) => ({ title, icon, href })),
    settingsEntry,
  ].filter(
    (entry) =>
      !trimmedQuery ||
      entry.title.toLowerCase().includes(trimmedQuery.toLowerCase()),
  );
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Find a course or material"
      description="Search your courses, this page, bookmarks, and recent history, or search the ILIAS repository."
      className="top-1/2 h-[min(88svh,52rem)] max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] -translate-y-1/2 gap-0 overflow-hidden p-0 sm:max-w-4xl"
    >
      <Command shouldFilter={false} className="h-auto min-h-0 flex-1">
        <CommandInput
          placeholder="Search courses, groups, folders, and materials…"
          value={searchQuery}
          onValueChange={(value) => {
            setSearchQuery(value);
            setShowAllLocal(false);
            searchRequest.current++;
            searchAbort.current?.abort();
            setDeepLoadingQuery(null);
            setDeepMoreLoading(false);
            loadingMore.current = false;
          }}
        />
        <CommandList
          className="min-h-0 flex-1 max-h-none"
          onScroll={onListScroll}
        >
          {navigationResults.length > 0 && (
            <CommandGroup heading="Navigate">
              {navigationResults.map(({ title, icon: Icon, href }) => (
                <CommandItem
                  key={href}
                  value={href}
                  onSelect={() => {
                    onOpenChange(false);
                    router.push(demoHref(href, demo));
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
                  ? "Your courses, this page & library"
                  : "Recent, your courses & this page"
              }
            >
              {localResults.map((item) => (
                <SearchResultOption
                  key={itemKey(item)}
                  item={item}
                  onSelect={onOpenItem}
                />
              ))}
              {!showAllLocal && localSearchResults.length > 16 && (
                <CommandItem
                  value="show-all-local"
                  onSelect={() => setShowAllLocal(true)}
                >
                  <Search />
                  Show all {localSearchResults.length} matches
                </CommandItem>
              )}
            </CommandGroup>
          )}
          {nearbyLoading && (
            <div role="status" className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching nearby folders…
            </div>
          )}
          {nearbyError && <div role="status" className="px-3 py-2 text-sm text-muted-foreground">{nearbyError} Repository search is still available.</div>}
          {catalogLoading && (
            <div
              role="status"
              className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" /> Loading your courses…
            </div>
          )}
          {accountCatalog?.status === "error" && (
            <CommandGroup heading="Course list unavailable">
              <div role="status" className="px-3 py-2 text-sm text-muted-foreground">
                {accountCatalog.error}
              </div>
              <CommandItem
                value="retry-courses"
                onSelect={() => {
                  setCatalog(null);
                  setCatalogRetry((value) => value + 1);
                }}
              >
                <Search /> Retry loading your courses
              </CommandItem>
            </CommandGroup>
          )}
          {accountCatalog?.hasMore && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              ILIAS shows only part of your course list. Search the ILIAS repository for more matches.
            </div>
          )}
          {trimmedQuery && !localResults.length && !catalogLoading && !deepResults.length && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {accountCatalog?.status === "ready"
                ? "No matches in your course list, this page, bookmarks, or recent history."
                : "No matches on this page, in bookmarks, or in recent history."}
            </div>
          )}
          {trimmedQuery && data.mode === "disconnected" && (
            <CommandGroup heading="Search the ILIAS repository">
              <CommandItem value="connect-to-search" onSelect={() => {
                onOpenChange(false);
                onConnect();
              }}>
                <ShieldCheck /> Connect your account to search ILIAS
              </CommandItem>
            </CommandGroup>
          )}
          {trimmedQuery && data.mode !== "disconnected" && (
            <>
              {resultGroups.filter((group) => group.items.length).map((group) => (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {group.items.map((item) => (
                    <SearchResultOption key={itemKey(item)} item={item} onSelect={onOpenItem} />
                  ))}
                </CommandGroup>
              ))}
              {trimmedQuery.length < 2 ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  Type at least 2 characters to search inside courses and subfolders.
                </div>
              ) : trimmedQuery.length > 200 ? (
                <div role="status" className="px-3 py-3 text-sm text-muted-foreground">
                  Use at most 200 characters to search ILIAS.
                </div>
              ) : deepLoading || (!deepForQuery && !currentDeepError) ? (
                <div role="status" className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {deepLoading ? deepStage : "Preparing to search courses and subfolders…"}
                </div>
              ) : null}
              {currentDeepError && (
                <CommandGroup heading="Search interrupted">
                  <div role="status" className="px-3 py-2 text-sm text-destructive">{currentDeepError}</div>
                  <CommandItem value="retry-deep-search" onSelect={() => void runDeepSearch()}>
                    <Search /> Try again
                  </CommandItem>
                </CommandGroup>
              )}
              {deepForQuery?.hasMore && !deepLoading && (
                <CommandGroup>
                  <CommandItem value="load-more-results" disabled={deepMoreLoading} onSelect={() => void loadMore()}>
                    {deepMoreLoading ? <Loader2 className="animate-spin" /> : <Search />}
                    {deepMoreLoading ? "Loading more results…" : "Load more results"}
                  </CommandItem>
                </CommandGroup>
              )}
              {deepMoreError && <div role="status" className="px-3 py-2 text-xs text-destructive">{deepMoreError}</div>}
              {deepForQuery && !deepLoading && !currentDeepError && !deepResults.length && (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  {deepForQuery.results.length ? "All ILIAS matches are already shown above." : `No indexed matches for “${trimmedQuery}” in ILIAS.`}
                </div>
              )}
            </>
          )}
        </CommandList>
      </Command>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        <span>
          {data.mode === "disconnected"
            ? "Local search works now. Connect to search the whole repository."
            : "Discovered items appear immediately. Nearby folders and ILIAS search load additional matches."}
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
  );
}
