"use client";
import { RefreshButton } from "@/components/navigation/refresh-button";
import type { Workspace } from "@/lib/ilias/types";
import type { WorkspaceViewName } from "./nav-items";

/** The large heading block for saved, browse, and courses views. */
export function PageHeading({
  view,
  data,
}: {
  data: Workspace;
  view: Extract<WorkspaceViewName, "browse" | "saved" | "courses">;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-2xl">
        <h1 className="page-title">
          {view === "saved"
            ? "Bookmarks"
            : view === "browse"
              ? data.page.title
              : "Courses"}
        </h1>
        {(view !== "browse" || data.page.description) && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {view === "saved"
              ? "Bookmarks are stored only in this browser."
              : view === "browse"
                ? data.page.description
                : "Your course and group memberships in ILIAS."}
          </p>
        )}
      </div>
      <div className="flex gap-2">{view !== "saved" && <RefreshButton />}</div>
    </div>
  );
}
