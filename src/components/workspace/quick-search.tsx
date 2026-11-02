"use client";
import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { useRouter } from "next/navigation";
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
import { mergeItems } from "@/lib/ilias/library";
import {
  matchesItem,
  rankByFamiliarity,
  searchTerms,
} from "@/lib/ilias/item-search";
import { itemKey, typeNames } from "@/lib/ilias/items";
import type { Item, Workspace } from "@/lib/ilias/types";

type DeepSearch = {
  query: string;
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
  const demo = data.mode === "demo";
  const [searchQuery, setSearchQuery] = useState("");
  const [deep, setDeep] = useState<DeepSearch | null>(null);
  const [deepLoadingQuery, setDeepLoadingQuery] = useState<string | null>(null);
  const [deepError, setDeepError] = useState<{
    query: string;
    message: string;
  } | null>(null);
  const [deepMoreLoading, setDeepMoreLoading] = useState(false);
  const [deepMoreError, setDeepMoreError] = useState("");
  const loadingMore = useRef(false);
  const searchRequest = useRef(0);
  const searchAbort = useRef<AbortController | null>(null);
  const wasOpen = useRef(false);
  const resetSearchState = () => {
    searchRequest.current++;
    searchAbort.current?.abort();
    searchAbort.current = null;
    setSearchQuery("");
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
  async function runDeepSearch() {
    const term = searchQuery.trim();
    if (term.length < 2) return;
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
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(term)}${demo ? "&demo=1" : ""}`,
        { cache: "no-store", signal: controller.signal },
      );
      const body = (await response.json()) as {
        error?: string;
        results?: Item[];
        sourceUrl?: string;
        hasMore?: boolean;
        page?: number;
      };
      if (!response.ok)
        throw new Error(body.error || "ILIAS search failed.");
      if (request !== searchRequest.current) return;
      setDeep({
        query: term,
        results: Array.isArray(body.results) ? body.results : [],
        sourceUrl: body.sourceUrl || data.page.sourceUrl,
        hasMore: Boolean(body.hasMore),
        page: body.page || 1,
      });
    } catch (error) {
      if (request !== searchRequest.current || controller.signal.aborted) return;
      setDeepError({
        query: term,
        message:
          error instanceof Error ? error.message : "ILIAS search failed.",
      });
    } finally {
      if (searchAbort.current === controller) searchAbort.current = null;
      if (request === searchRequest.current) setDeepLoadingQuery(null);
    }
  }
  const trimmedQuery = searchQuery.trim();
  const localSearchResults = useMemo(() => {
    const terms = searchTerms(trimmedQuery);
    const matches = terms.length
      ? allItems.filter((item) => matchesItem(item, terms))
      : mergeItems(recent, pageItems);
    return matches.slice(0, 16);
  }, [allItems, recent, pageItems, trimmedQuery]);
  const deepForQuery = deep?.query === trimmedQuery ? deep : null;
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
          hasMore: Boolean(body.hasMore) && added.length > 0,
        };
      });
    } catch (error) {
      if (request !== searchRequest.current || controller.signal.aborted) return;
      setDeepMoreError(
        error instanceof Error ? error.message : "Could not load more results.",
      );
    } finally {
      loadingMore.current = false;
      if (searchAbort.current === controller) searchAbort.current = null;
      if (request === searchRequest.current) setDeepMoreLoading(false);
    }
  }
  function onListScroll(event: UIEvent<HTMLDivElement>) {
    const list = event.currentTarget;
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 120)
      void loadMore();
  }
  const localKeys = new Set(localSearchResults.map(itemKey));
  const deepContext = new Map<string, string>();
  for (const item of deepForQuery?.results || [])
    if (item.context) deepContext.set(itemKey(item), item.context);
  const localResults = localSearchResults.map((item) => {
    const context = item.context || deepContext.get(itemKey(item));
    return context && !item.context ? { ...item, context } : item;
  });
  const deepResults = rankByFamiliarity(
    deepForQuery?.results.filter((item) => !localKeys.has(itemKey(item))) || [],
    mergeItems(saved, recent),
  );
  const deepLoading = deepLoadingQuery === trimmedQuery;
  const currentDeepError =
    deepError?.query === trimmedQuery ? deepError.message : "";
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
      description="Search this page, bookmarks, recent history, and all your courses in ILIAS."
      className="top-1/2 h-[min(88svh,52rem)] max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] -translate-y-1/2 gap-0 overflow-hidden p-0 sm:max-w-4xl"
    >
      <Command shouldFilter={false} className="h-auto min-h-0 flex-1">
        <CommandInput
          placeholder="Search courses, groups, folders, and materials…"
          value={searchQuery}
          onValueChange={setSearchQuery}
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
                  ? "On this page, bookmarks & recent"
                  : "Recent & on this page"
              }
            >
              {localResults.map((item) => (
                <SearchResultOption
                  key={itemKey(item)}
                  item={item}
                  onSelect={onOpenItem}
                />
              ))}
            </CommandGroup>
          )}
          {trimmedQuery && !localResults.length && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No match in this page, bookmarks, or recent history.
            </div>
          )}
          {trimmedQuery &&
            (deepForQuery &&
            (deepResults.length > 0 ||
              deepForQuery.hasMore ||
              Boolean(deepMoreError)) ? (
              <CommandGroup heading="Other matches in ILIAS">
                {deepResults.map((item) => (
                  <SearchResultOption
                    key={itemKey(item)}
                    item={item}
                    onSelect={onOpenItem}
                  />
                ))}
                {deepForQuery.hasMore && (
                  <CommandItem
                    value="load-more-results"
                    disabled={deepMoreLoading}
                    onSelect={() => void loadMore()}
                  >
                    {deepMoreLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Search />
                    )}
                    {deepMoreLoading
                      ? "Loading more results…"
                      : "Load more results"}
                  </CommandItem>
                )}
                {deepMoreError && (
                  <div className="px-3 py-2 text-xs text-destructive">
                    {deepMoreError}
                  </div>
                )}
              </CommandGroup>
            ) : (
              <CommandGroup heading="All your courses">
                {data.mode === "disconnected" ? (
                  <CommandItem
                    value="connect-to-search"
                    onSelect={() => {
                      onOpenChange(false);
                      onConnect();
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
  );
}
