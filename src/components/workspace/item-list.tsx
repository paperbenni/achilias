"use client";

import type { ComponentProps } from "react";
import { Info, Bookmark, ChevronRight, ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardAction,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  isContainerType,
  isExternalItem,
  isSupportedItemType,
  itemKey,
  typeNames,
} from "@/lib/ilias/items";
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
        const summary =
          item.meta || (isContainerType(item.type) ? "" : item.description);
        // Course cards keep their description; other containers repeat ILIAS
        // instructions ("Dateien hochladen") instead of summarising themselves.
        const cardSummary =
          item.type === "crs" || item.type === "grp"
            ? item.description
            : summary;
        return grid && layout === "grid" ? (
          <Card
            key={itemKey(item)}
            role="listitem"
            className="course-card relative min-w-0"
          >
            <CardHeader>
              <span
                className="course-monogram"
                data-tone={index % 3}
                aria-hidden="true"
              >
                <Icon className="size-6" />
              </span>
              {item.type !== "crs" && (
                <CardDescription>
                  {typeNames[item.type] || "ILIAS object"}
                </CardDescription>
              )}
              <CardTitle className="col-span-2 min-w-0">
                <ItemAction
                  textLink
                  className="resource-primary inline-flex gap-1 after:absolute after:inset-0 after:rounded-xl"
                  item={item}
                  demo={demo}
                  onOpen={onOpen}
                  onVisit={onVisit}
                >
                  {item.title}
                </ItemAction>
              </CardTitle>
              <CardAction className="relative z-10 flex items-center gap-1">
                {item.meta && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Details for ${item.title}`}
                      >
                        <Info />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{item.meta}</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${isSaved ? "Remove bookmark" : "Bookmark"} ${item.title}`}
                      aria-pressed={isSaved}
                      onClick={() => onToggleSave(item)}
                    >
                      <Bookmark className={cn(isSaved && "fill-current")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isSaved ? "Remove bookmark" : "Bookmark"}
                  </TooltipContent>
                </Tooltip>
              </CardAction>
            </CardHeader>
            {(cardSummary || item.context) && (
              <CardContent>
                {cardSummary && (
                  <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {cardSummary}
                  </p>
                )}
                {item.context && (
                  <p
                    className={cn(
                      cardSummary && "mt-2",
                      "line-clamp-1 text-xs text-muted-foreground/80",
                    )}
                    title={item.context}
                  >
                    {item.context}
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        ) : (
          <ResourceItem
            key={itemKey(item)}
            role="listitem"
            variant="outline"
            className="resource-row relative min-w-0 flex-nowrap"
          >
            <ItemMedia variant="icon" className="self-center">
              <Icon />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="max-w-full">
                <ItemAction
                  textLink
                  className="resource-primary resource-title hover:underline px-0 after:absolute after:inset-0 after:rounded-lg"
                  item={item}
                  demo={demo}
                  onOpen={onOpen}
                  onVisit={onVisit}
                >
                  {item.title}
                </ItemAction>
              </ItemTitle>
              {/* A container's ILIAS description is often an instruction, not a
                  summary; its own page repeats it in the heading. */}
              {summary && (
                <ItemDescription className="line-clamp-1">
                  {summary}
                </ItemDescription>
              )}
              {item.context && (
                <p
                  className="line-clamp-1 text-xs text-muted-foreground/80"
                  title={item.context}
                >
                  {item.context}
                </p>
              )}
            </ItemContent>
            <ItemActions className="relative z-10">
              {!item.available ? (
                <Badge variant="outline">Restricted</Badge>
              ) : isExternalItem(item) ? (
                <Badge variant="outline" className="hidden sm:inline-flex">
                  External <ArrowUpRight />
                </Badge>
              ) : !isSupportedItemType(item.type) ? (
                <Badge variant="outline" className="hidden sm:inline-flex">
                  In ILIAS <ArrowUpRight />
                </Badge>
              ) : null}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onToggleSave(item)}
                aria-label={`${isSaved ? "Remove bookmark" : "Bookmark"} ${item.title}`}
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

/** ItemList's own props, reusable by sections that also pass `items`. */
export type ItemListProps = Omit<ComponentProps<typeof ItemList>, "items">;
