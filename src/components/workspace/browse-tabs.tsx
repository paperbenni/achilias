"use client";
import type { ReactNode } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import type { Item, Workspace } from "@/lib/ilias/types";

/** The browse-view tabs: course information, upstream tools, and materials. */
export function BrowseTabs({
  data,
  demo,
  source,
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
  empty: (title: string, description: string) => ReactNode;
  itemProps: ItemListProps;
  items: Item[];
  layout: string;
  onLayoutChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  query: string;
  source: string;
  total: number;
  objectType?: string;
}) {
  const spaceLabel = objectType === "grp" ? "group" : "course";
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
                onChange={(e) => onQueryChange(e.target.value)}
              />
            </InputGroup>
          </div>
          <LayoutToggle layout={layout} onLayoutChange={onLayoutChange} />
        </div>
        {items.length ? (
          <ItemList {...itemProps} items={items} grid />
        ) : (
          empty(
            query
              ? "No matching materials"
              : data.page.membership === "guest"
                ? "No materials available to guests"
                : "No materials found",
            query
              ? "Try a different word or clear the filter."
              : data.page.membership === "guest"
                ? data.page.joinUrl
                  ? `Join this ${spaceLabel} in ILIAS to see its materials and activities.`
                  : `You’re viewing this ${spaceLabel} as a guest. Open it in ILIAS for course information and access details.`
                : "This space may be empty, restricted, or use a layout Achilias cannot read yet. Check the original ILIAS page.",
          )
        )}
      </TabsContent>
    </Tabs>
  );
}
