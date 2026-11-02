import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div
      className="flex min-h-screen"
      role="status"
      aria-label="Loading your learning space"
    >
      <div className="hidden w-64 flex-col gap-6 border-r bg-sidebar p-6 md:flex">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-16 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-8 p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 max-w-96" />
        <div className="grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-60" />
          ))}
        </div>
        <span className="sr-only">Loading your learning space…</span>
      </div>
    </div>
  );
}
