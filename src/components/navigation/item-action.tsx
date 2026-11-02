"use client";
import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  canPrefetchItem,
  isContainerType,
  isExternalItem,
  isFileItem,
  itemOpenHref,
  isNavigableItem,
  itemHref,
} from "@/lib/ilias/items";
import type { Item } from "@/lib/ilias/types";
export function NavigationHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-4 shrink-0 items-center justify-center"
    >
      {pending && <Loader2 className="size-3 animate-spin" />}
    </span>
  );
}
export function ItemAction({
  item,
  demo,
  onOpen,
  onVisit,
  children,
  textLink = false,
  ...props
}: {
  item: Item;
  demo: boolean;
  onOpen: (item: Item) => void;
  onVisit: (item: Item) => void;
  children: React.ReactNode;
  textLink?: boolean;
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "asChild">) {
  if (isExternalItem(item) || isFileItem(item)) {
    if (textLink)
      return (
        <a
          href={itemOpenHref(item, demo)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onVisit(item)}
          className={props.className}
          aria-label={props["aria-label"]}
        >
          {children}
        </a>
      );
    return (
      <Button {...props} asChild>
        <a
          href={itemOpenHref(item, demo)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onVisit(item)}
        >
          {children}
        </a>
      </Button>
    );
  }
  // An unavailable container is non-clickable in ILIAS; do not turn it into
  // a modal or a fake navigation target just because it was rendered as a card.
  if (!item.available && isContainerType(item.type)) {
    if (textLink)
      return (
        <span className={props.className} aria-disabled="true">
          {children}
        </span>
      );
    return null;
  }
  // Popup semantics also prevent Button's active translation from changing
  // the containing block of a stretched card or row hit area.
  if (!isNavigableItem(item))
    return (
      <Button
        {...props}
        type="button"
        variant={textLink ? "link" : props.variant}
        className={cn(
          "cursor-pointer",
          textLink && "h-auto justify-start whitespace-normal p-0 text-left",
          props.className,
        )}
        aria-haspopup="dialog"
        onClick={() => onOpen(item)}
      >
        {children}
      </Button>
    );
  // Prefetch the full ILIAS-backed route once the link is visible or hovered.
  // Forum pages stay out: an upstream GET can record read state, unlike
  // course, folder, and exercise pages.
  const prefetch = canPrefetchItem(item, demo);
  if (textLink)
    return (
      <Link
        href={itemHref(item, demo)}
        prefetch={prefetch}
        onClick={() => onVisit(item)}
        className={props.className}
        aria-label={props["aria-label"]}
      >
        {children}
        <NavigationHint />
      </Link>
    );
  return (
    <Button {...props} asChild>
      <Link
        href={itemHref(item, demo)}
        prefetch={prefetch}
        onClick={() => onVisit(item)}
      >
        {children}
        {!props.size?.startsWith("icon") && <NavigationHint />}
      </Link>
    </Button>
  );
}
