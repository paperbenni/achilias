"use client";

import { ArrowUpRight, Bookmark, ChevronRight } from "lucide-react";

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

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { isSupportedItemType, itemKey, typeNames } from "@/lib/ilias/items";
import type { Item } from "@/lib/ilias/types";
import { cn } from "@/lib/utils";
import {
  Item as ResourceItem,
  ItemGroup,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";
import { ItemAction } from "@/components/navigation/item-action";

import { iconFor } from "./item-icon";
export function ItemList({
  items: list,
  grid = false,
  layout,
  saved,
  demo,
  onOpen,
  onVisit,
  onToggleSave,
}: {
  items: Item[];
  grid?: boolean;
  layout: string;
  saved: Item[];
  demo: boolean;
  onOpen: (item: Item) => void;
  onVisit: (item: Item) => void;
  onToggleSave: (item: Item) => void;
}) {
  return (
    <ItemGroup
      aria-label="Learning resources"
      className={cn(
        grid && layout === "grid"
          ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          : "flex flex-col gap-2",
      )}
    >
      {list.map((item, index) => {
        const Icon = iconFor(item.type);
        const isSaved = saved.some((i) => itemKey(i) === itemKey(item));
        return grid && layout === "grid" ? (
          <Card
            key={itemKey(item)}
            role="listitem"
            className="course-card group"
          >
            <CardHeader>
              <div className="mb-5 flex items-start justify-between">
                <span className="course-monogram" data-tone={index % 3}>
                  <Icon className="size-6" />
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${isSaved ? "Unsave" : "Save"} ${item.title}`}
                      aria-pressed={isSaved}
                      onClick={() => onToggleSave(item)}
                    >
                      <Bookmark className={cn(isSaved && "fill-current")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isSaved ? "Remove from saved" : "Save for later"}
                  </TooltipContent>
                </Tooltip>
              </div>
              <CardDescription>
                {typeNames[item.type] || "ILIAS object"}
              </CardDescription>
              <CardTitle>
                <ItemAction
                  variant="link"
                  className="course-title"
                  item={item}
                  demo={demo}
                  onOpen={onOpen}
                  onVisit={onVisit}
                >
                  {item.title}
                </ItemAction>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
                {item.description ||
                  "Open this learning space to find your materials."}
              </p>
            </CardContent>
            <CardFooter className="justify-between">
              <span className="truncate text-xs text-muted-foreground">
                {item.meta ||
                  (demo ? "Example course" : "From your ILIAS dashboard")}
              </span>
              <ItemAction
                variant="ghost"
                size="icon-sm"
                aria-label={`Open ${item.title}`}
                item={item}
                demo={demo}
                onOpen={onOpen}
                onVisit={onVisit}
              >
                <ArrowUpRight />
              </ItemAction>
            </CardFooter>
          </Card>
        ) : (
          <ResourceItem
            key={itemKey(item)}
            role="listitem"
            variant="outline"
            className="resource-row min-w-0 flex-nowrap"
          >
            <ItemMedia variant="icon">
              <Icon />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="max-w-full">
                <ItemAction
                  variant="link"
                  className="resource-title"
                  item={item}
                  demo={demo}
                  onOpen={onOpen}
                  onVisit={onVisit}
                >
                  {item.title}
                </ItemAction>
              </ItemTitle>
              <ItemDescription className="line-clamp-1">
                {item.meta ||
                  item.description ||
                  typeNames[item.type] ||
                  item.type}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              {!item.available ? (
                <Badge variant="outline">Restricted</Badge>
              ) : !isSupportedItemType(item.type) ? (
                <Badge variant="outline" className="hidden sm:inline-flex">
                  In ILIAS <ArrowUpRight />
                </Badge>
              ) : (
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {typeNames[item.type]}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onToggleSave(item)}
                aria-label={`${isSaved ? "Unsave" : "Save"} ${item.title}`}
                aria-pressed={isSaved}
              >
                <Bookmark className={cn(isSaved && "fill-current")} />
              </Button>
              <ItemAction
                variant="ghost"
                size="icon-sm"
                aria-label={`Open ${item.title}`}
                item={item}
                demo={demo}
                onOpen={onOpen}
                onVisit={onVisit}
              >
                <ChevronRight />
              </ItemAction>
            </ItemActions>
          </ResourceItem>
        );
      })}
    </ItemGroup>
  );
}
