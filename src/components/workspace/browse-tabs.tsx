"use client";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CircleHelp,
  FolderSearch,
  Loader2,
  Search,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OriginalLink } from "@/components/navigation/original-link";
import { GuestMembershipAlert } from "./guest-membership-alert";
import { ItemList, type ItemListProps } from "./item-list";
import { LayoutToggle } from "./layout-toggle";
import { itemKey } from "@/lib/ilias/items";
import { mergeItems } from "@/lib/ilias/library";
import type { Item, Workspace } from "@/lib/ilias/types";

type DeepSearch = {
  query: string;
  status: "loading" | "ready" | "error";
  results: Item[];
  sourceUrl: string;
  hasMore: boolean;
  error?: string;
};

/** Below this many local matches, offer to search the whole container. */
const deepSearchThreshold = 4;

/** The browse-view tabs: course information, upstream tools, and materials. */
export function BrowseTabs({
  data,
  demo,
  source,
  objectId,
  query,
  onQueryChange,
  items,
  total,
  itemProps,
  layout,
  onLayoutChange,
  empty,
  objectType,
}: {
  data: Workspace;
  demo: boolean;
  empty: (title: string, description: string, action?: ReactNode) => ReactNode;
  itemProps: ItemListProps;
  items: Item[];
  layout: string;
  objectId?: string;
  onLayoutChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  query: string;
  source: string;
  total: number;
  objectType?: string;
}) {
  const spaceLabel =
    objectType === "grp"
      ? "group"
      : objectType === "cat"
        ? "category"
        : objectType === "fold"
          ? "folder"
          : "course";
  const trimmedQuery = query.trim();
  const [deepSearch, setDeepSearch] = useState<DeepSearch | null>(null);
  const deepAbort = useRef<AbortController | null>(null);
  const deepRequest = useRef(0);
  useEffect(() => () => deepAbort.current?.abort(), []);
  // Results belong to the query that started them; a stale response must not
  // replace matches for what the user is typing now.
  const deep = deepSearch?.query === trimmedQuery ? deepSearch : null;
  const readyDeep = deep?.status === "ready" ? deep : null;
  const loadingDeep = deep?.status === "loading" ? deep : null;
  const errorDeep = deep?.status === "error" ? deep : null;
  const localKeys = new Set(items.map(itemKey));
  const deepMatches = readyDeep
    ? mergeItems(readyDeep.results).filter(
        (item) => !localKeys.has(itemKey(item)),
      )
    : [];
  const canSearchDeeper =
    Boolean(objectId) &&
    trimmedQuery.length >= 2 &&
    trimmedQuery.length <= 200;
  const canOfferDeepSearch =
    canSearchDeeper && !deep && items.length < deepSearchThreshold;
  const offerInEmptyState = canOfferDeepSearch && items.length === 0;
  const showOfferBar = canOfferDeepSearch && items.length > 0;

  function resetDeepSearch() {
    deepRequest.current += 1;
    deepAbort.current?.abort();
    deepAbort.current = null;
    setDeepSearch(null);
  }

  function changeQuery(value: string) {
    resetDeepSearch();
    onQueryChange(value);
  }

  async function searchDeeper() {
    if (!canSearchDeeper || !objectId) return;
    const term = trimmedQuery;
    const request = ++deepRequest.current;
    deepAbort.current?.abort();
    const controller = new AbortController();
    deepAbort.current = controller;
    setDeepSearch({
      query: term,
      status: "loading",
      results: [],
      sourceUrl: source,
      hasMore: false,
    });
    try {
      const params = new URLSearchParams({ q: term, root: objectId });
      if (demo) params.set("demo", "1");
      const response = await fetch(`/api/search?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = (await response.json()) as {
        error?: string;
        results?: Item[];
        sourceUrl?: string;
        hasMore?: boolean;
      };
      if (request !== deepRequest.current || controller.signal.aborted) return;
      if (!response.ok)
        throw new Error(body.error || `Could not search this ${spaceLabel}.`);
      setDeepSearch({
        query: term,
        status: "ready",
        results: Array.isArray(body.results) ? body.results : [],
        sourceUrl: body.sourceUrl || source,
        hasMore: Boolean(body.hasMore),
      });
    } catch (error) {
      if (request !== deepRequest.current || controller.signal.aborted) return;
      setDeepSearch({
        query: term,
        status: "error",
        results: [],
        sourceUrl: source,
        hasMore: false,
        error:
          error instanceof Error
            ? error.message
            : `Could not search this ${spaceLabel}.`,
      });
    } finally {
      if (deepAbort.current === controller) deepAbort.current = null;
    }
  }

  const searchDeeperAction = (
    <Button variant="outline" size="sm" onClick={() => void searchDeeper()}>
      <FolderSearch />
      Search this {spaceLabel} and its subfolders
    </Button>
  );

  return (
    <Tabs defaultValue="materials">
      <GuestMembershipAlert
        page={data.page}
        sourceUrl={source}
        objectType={objectType}
      />
      <TabsList>
        <TabsTrigger value="materials">
          Materials <Badge variant="secondary">{total}</Badge>
        </TabsTrigger>
        <TabsTrigger value="information">Course information</TabsTrigger>
        <TabsTrigger value="tools">
          ILIAS tools <ArrowUpRight />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="information" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>From your course page</CardTitle>
            <CardDescription>
              HTML-based: introductory text is extracted from ILIAS. Changes to
              its layout can omit content. Open the original for links, media,
              and the full layout.
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
            <CardTitle>Course tools in ILIAS</CardTitle>
            <CardDescription>
              HTML-based: these links are extracted from the course page and may
              be incomplete after an ILIAS update. Each opens the original
              interface.
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
            {!data.page.tools.length && <OriginalLink href={source} />}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="materials" className="mt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="w-full max-w-md">
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Find something in this space…"
                aria-label="Filter materials"
                value={query}
                onChange={(e) => changeQuery(e.target.value)}
              />
            </InputGroup>
          </div>
          <LayoutToggle layout={layout} onLayoutChange={onLayoutChange} />
        </div>
        {items.length ? (
          <ItemList {...itemProps} items={items} grid />
        ) : readyDeep ? (
          deepMatches.length ? null : empty(
            readyDeep.hasMore ? "No matches on this result page" : "No matching materials",
            readyDeep.hasMore
              ? "ILIAS has more results. Open the search in ILIAS to continue."
              : `Searched this ${spaceLabel} and its subfolders too. Try a different word or check the original ILIAS page.`,
          )
        ) : loadingDeep ? null : (
          empty(
            query
              ? "No matching materials"
              : data.page.membership === "guest"
                ? "No materials available to guests"
                : "No materials found",
            query
              ? offerInEmptyState
                ? `Try a different word, or search this ${spaceLabel} and its subfolders.`
                : "Try a different word or clear the filter."
              : data.page.membership === "guest"
                ? data.page.joinUrl
                  ? `Join this ${spaceLabel} in ILIAS to see its materials and activities.`
                  : `You’re viewing this ${spaceLabel} as a guest. Open it in ILIAS for course information and access details.`
                : "This space may be empty, restricted, or use a layout Achilias cannot read yet. Check the original ILIAS page.",
            offerInEmptyState ? searchDeeperAction : undefined,
          )
        )}
        {showOfferBar && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {items.length === 1
                ? "Only one match on this page."
                : `Only ${items.length} matches on this page.`}{" "}
              Search the whole {spaceLabel}?
            </p>
            {searchDeeperAction}
          </div>
        )}
        {loadingDeep && (
          <div
            role="status"
            className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" />
            Searching this {spaceLabel} and its subfolders…
          </div>
        )}
        {errorDeep && (
          <Alert variant="destructive" className="mt-5">
            <CircleHelp />
            <AlertTitle>Couldn’t search this {spaceLabel}</AlertTitle>
            <AlertDescription>
              {errorDeep.error}
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void searchDeeper()}
                >
                  Try again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        {readyDeep && deepMatches.length > 0 && (
          <section className="mt-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="section-title">
                {items.length
                  ? `More inside this ${spaceLabel}`
                  : `Found inside this ${spaceLabel}`}
              </h2>
              <Badge variant="secondary">{deepMatches.length}</Badge>
            </div>
            <ItemList {...itemProps} items={deepMatches} grid />
          </section>
        )}
        {readyDeep &&
          deepMatches.length === 0 &&
          items.length > 0 && (
            <p className="mt-5 text-sm text-muted-foreground">
              {readyDeep.hasMore
                ? "No additional matches on this result page."
                : `No other matches in this ${spaceLabel} or its subfolders.`}
            </p>
          )}
        {readyDeep && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <OriginalLink href={readyDeep.sourceUrl} compact>
              Open this search in ILIAS
            </OriginalLink>
            {readyDeep.hasMore && (
              <p className="text-xs text-muted-foreground">
                ILIAS has more results than shown here.
              </p>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
