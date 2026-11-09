"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/navigation/refresh-button";
import type { Workspace } from "@/lib/ilias/types";
import type { WorkspaceViewName } from "./nav-items";

/** The large heading block for saved, browse, and courses views. */
export function PageHeading({
  view,
  data,
  back,
}: {
  data: Workspace;
  back?: { title: string; href: string; history?: boolean };
  view: Extract<WorkspaceViewName, "browse" | "saved" | "courses">;
}) {
  const router = useRouter();
  return (
    <div className={view === "browse" ? "flex items-center justify-between gap-3" : "flex flex-wrap items-end justify-between gap-5"}>
      <div className="flex min-w-0 items-center gap-2">
        {view === "browse" && back && (
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link
              href={back.href}
              prefetch={data.mode === "demo"}
              aria-label={`Back to ${back.title}`}
              onNavigate={(event) => {
                if (back.history) {
                  event.preventDefault();
                  router.back();
                }
              }}
            >
              <ArrowLeft />
            </Link>
          </Button>
        )}
        <div className="min-w-0 max-w-2xl">
          <h1 className={view === "browse" ? "break-words text-2xl font-medium leading-tight tracking-tight sm:text-3xl" : "page-title"}>
            {view === "saved"
              ? "Bookmarks"
              : view === "browse"
                ? data.page.title
                : "Courses"}
          </h1>
          {view !== "browse" && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {view === "saved"
                ? "Bookmarks are stored only in this browser."
                : "Your course and group memberships in ILIAS."}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">{view !== "saved" && <RefreshButton iconOnly={view === "browse"} />}</div>
    </div>
  );
}
