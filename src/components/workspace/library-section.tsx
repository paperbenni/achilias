"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { RefreshButton } from "@/components/navigation/refresh-button";
import { ItemList, type ItemListProps } from "./item-list";
import { LayoutToggle } from "./layout-toggle";
import { demoHref } from "./nav-items";
import type { WorkspaceViewName } from "./nav-items";
import type { Item } from "@/lib/ilias/types";

type LibraryView = Extract<WorkspaceViewName, "home" | "saved" | "courses">;

/**
 * The heading, filter, and layout-toggle section shared by the home,
 * saved, and courses views, rendering whichever list applies.
 */
export function LibrarySection({
  view,
  demo,
  items,
  courses,
  query,
  onQueryChange,
  layout,
  onLayoutChange,
  itemProps,
  empty,
}: {
  courses: Item[];
  demo: boolean;
  empty: (title?: string, description?: string) => ReactNode;
  itemProps: ItemListProps;
  items: Item[];
  layout: string;
  onLayoutChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  query: string;
  view: LibraryView;
}) {
  return (
    <section className="flex flex-col gap-5" id="courses">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {view === "home" ? (
            <h2 className="section-title">
              <Link
                prefetch={demo}
                href={demoHref("/courses", demo)}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
              >
                Your courses
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </h2>
          ) : null}
          <Badge variant="secondary">
            {view === "saved"
              ? `${items.length} ${items.length === 1 ? "bookmark" : "bookmarks"}`
              : view === "courses"
                ? `${courses.length} ${courses.length === 1 ? "course or group" : "courses and groups"}`
                : courses.length}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {view === "home" && <RefreshButton />}
          <div className="w-44 sm:w-56">
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Filter courses and materials"
                placeholder={
                  view === "saved"
                    ? "Find a bookmark…"
                    : "Find a course or group…"
                }
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
              />
            </InputGroup>
          </div>
          <LayoutToggle layout={layout} onLayoutChange={onLayoutChange} />
        </div>
      </div>
      {view === "saved" ? (
        items.length ? (
          <ItemList {...itemProps} items={items} />
        ) : (
          empty(
            query ? "No matching bookmarks" : "No bookmarks yet",
            query
              ? "Try a different search."
              : "Use the bookmark beside any course or material to keep it here.",
          )
        )
      ) : courses.length ? (
        <ItemList {...itemProps} items={courses} grid />
      ) : (
        empty(
          query ? "No matching courses" : "No courses found",
          query
            ? "Try a different search."
            : "No course or group memberships were found in ILIAS. Open ILIAS to check your enrollments.",
        )
      )}
    </section>
  );
}
