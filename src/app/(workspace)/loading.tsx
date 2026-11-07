import { SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Content-only fallback. The sidebar lives in the workspace layout, so it stays
 * mounted while a page streams in.
 */
export default function Loading() {
  return (
    <SidebarInset>
      <div className="flex h-20 shrink-0 items-center justify-between gap-4 border-b px-5 lg:px-10">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="size-9 rounded-md" />
      </div>
      <div
        className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 lg:px-10 lg:py-10"
        role="status"
        aria-label="Loading your learning space"
      >
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 max-w-96" />
        <div className="grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-60" />
          ))}
        </div>
        <span className="sr-only">Loading your learning space…</span>
      </div>
    </SidebarInset>
  );
}
