"use client";
import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { containers, itemHref, type Item } from "@/lib/ilias/types";
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
  ...props
}: {
  item: Item;
  demo: boolean;
  onOpen: (item: Item) => void;
  onVisit: (item: Item) => void;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "asChild">) {
  const navigable =
    item.available && (containers.has(item.type) || item.type === "frm");
  if (!navigable)
    return (
      <Button {...props} onClick={() => onOpen(item)}>
        {children}
      </Button>
    );
  return (
    <Button {...props} asChild>
      <Link
        href={itemHref(item, demo)}
        prefetch={demo}
        onClick={() => onVisit(item)}
      >
        {children}
        {!props.size?.startsWith("icon") && <NavigationHint />}
      </Link>
    </Button>
  );
}
