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
import { ItemList, type ItemListProps } from "./item-list";
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
  empty,
}: {
  data: Workspace;
  demo: boolean;
  empty: (title: string, description: string) => ReactNode;
  itemProps: ItemListProps;
  items: Item[];
  onQueryChange: (value: string) => void;
  query: string;
  source: string;
  total: number;
}) {
  return (
    <Tabs defaultValue="materials">
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
            <CardTitle>Keep the full course within reach</CardTitle>
            <CardDescription>
              HTML-based: these links are extracted from the course page and
              may be incomplete after an ILIAS update. Each opens the original
              interface.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {data.page.tools.map((tool) => (
              <OriginalLink key={tool.title} href={demo ? data.instance : tool.url}>
                {tool.title}
              </OriginalLink>
            ))}
            {!data.page.tools.length && <OriginalLink href={source} />}
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
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </InputGroup>
        </div>
        {items.length ? (
          <ItemList {...itemProps} items={items} />
        ) : (
          empty(
            query ? "No matching materials" : "No materials found",
            query
              ? "Try a different word or clear the filter."
              : "This space may be empty, restricted, or use a layout Achilias cannot read yet. Check the original ILIAS page.",
          )
        )}
      </TabsContent>
    </Tabs>
  );
}
