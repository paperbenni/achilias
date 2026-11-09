"use client";

import { useEffect, useRef, useState } from "react";
import { FolderX, ListTree } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { demoPage } from "@/lib/ilias/demo";
import { isPreviewableContainer, typeNames } from "@/lib/ilias/items";
import type { ContainerPreviewData, Item } from "@/lib/ilias/types";
import { cn } from "@/lib/utils";

import { iconFor } from "./item-icon";

const previewLimit = 3;

function demoPreview(item: Item): ContainerPreviewData | null {
  if (!["crs", "fold", "grp"].includes(item.type)) return null;
  const page = demoPage(item.type, item.id);
  return {
    count: page.items.length,
    items: page.items
      .slice(0, previewLimit)
      .map(({ type, title }) => ({ type, title })),
    truncated: page.items.length > previewLimit,
    hasMore: page.hasMore,
  };
}

function countLabel(preview: ContainerPreviewData) {
  return `${preview.count}${preview.hasMore ? "+" : ""} ${preview.count === 1 ? "item" : "items"}`;
}

/** Presentational preview, kept separate so it can be rendered without effects. */
export function ContainerPreviewContent({
  preview,
  type,
  variant = "card",
  className,
}: {
  className?: string;
  preview: ContainerPreviewData;
  type: string;
  variant?: "card" | "row";
}) {
  const label = (typeNames[type] || "container").toLowerCase();
  const empty = preview.count === 0;
  if (variant === "row")
    return (
      <p
        className={cn(
          "line-clamp-1 text-xs text-muted-foreground/80",
          className,
        )}
      >
        {empty ? (
          `No visible items in this ${label}`
        ) : (
          <>
            {countLabel(preview)} ·{" "}
            {preview.items.map((item) => item.title).join(", ")}
            {preview.truncated ? " …" : ""}
          </>
        )}
      </p>
    );
  return (
    <div className={cn("mt-3 border-t border-border/60 pt-2.5", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {empty ? (
          <FolderX className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ListTree className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        {empty ? `No visible items in this ${label}` : countLabel(preview)}
      </p>
      {!empty && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {preview.items.map((item) => {
            const Icon = iconFor(item.type);
            return (
              <li
                key={`${item.type}:${item.title}`}
                className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-muted-foreground"
              >
                <Icon
                  className="size-3 shrink-0 opacity-70"
                  aria-hidden="true"
                />
                <span className="truncate" title={item.title}>
                  {item.title}
                </span>
              </li>
            );
          })}
          {preview.truncated && (
            <li
              className="pl-[18px] text-xs leading-4 text-muted-foreground/60"
              aria-hidden="true"
            >
              …
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Load a container's contents when its card approaches the viewport. Empty
 * categories and folders become visible before opening them, and a card with
 * many children shows its first few entries instead of a blank description.
 */
export function ContainerPreview({
  item,
  demo,
  connection,
  variant = "card",
}: {
  connection?: string;
  demo: boolean;
  item: Item;
  variant?: "card" | "row";
}) {
  const [preview, setPreview] = useState<
    ContainerPreviewData | null | undefined
  >(() => (demo ? demoPreview(item) : undefined));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preview !== undefined || demo || !connection) return;
    const element = ref.current;
    if (!element) return;
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `/api/containers/${item.type}/${item.id}/preview`,
          {
            method: "POST",
            headers: { "x-achilias-connection": connection! },
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Preview unavailable.");
        const body = (await response.json().catch(() => ({}))) as {
          preview?: ContainerPreviewData | null;
        };
        if (!cancelled) setPreview(body.preview || null);
      } catch {
        // A preview is optional; the card still opens the container.
        if (!cancelled) setPreview(null);
      }
    }

    if (typeof IntersectionObserver === "undefined") {
      void load();
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void load();
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      controller.abort();
      observer.disconnect();
    };
  }, [connection, demo, item.id, item.type, preview]);

  if (!isPreviewableContainer(item.type)) return null;
  if (preview === undefined) {
    if (!connection && !demo) return null;
    return (
      <div ref={ref} aria-hidden="true">
        <Skeleton
          className={cn(
            variant === "row" ? "mt-1 h-3 w-2/3" : "mt-3 h-14",
          )}
        />
      </div>
    );
  }
  if (preview === null) return null;
  return (
    <div ref={ref}>
      <ContainerPreviewContent
        preview={preview}
        type={item.type}
        variant={variant}
      />
    </div>
  );
}
