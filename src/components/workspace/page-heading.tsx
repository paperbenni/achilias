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
        {(view === "saved" || view === "courses") && (
          <p className="eyebrow">
            {view === "saved"
              ? "THE GOOD STUFF, WITHIN REACH"
              : "EVERY COURSE, ONE PLACE"}
          </p>
        )}
        <h1 className="page-title mt-3">
          {view === "saved"
            ? "Bookmarks."
            : view === "browse"
              ? data.page.title
              : "Your courses."}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {view === "saved"
            ? "The courses and materials you’ve bookmarked. Stored only in this browser."
            : view === "browse"
              ? data.page.description ||
                "Everything in this space, with a clearer way through."
              : "Every course and group from your ILIAS dashboard, with a clearer way in."}
        </p>
      </div>
      <div className="flex gap-2">{view !== "saved" && <RefreshButton />}</div>
    </div>
  );
}
