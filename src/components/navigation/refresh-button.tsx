"use client";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshWorkspace } from "@/app/actions/workspace";
import { cn } from "@/lib/utils";

export function RefreshButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon" : "default"}
      disabled={pending}
      title={iconOnly ? (pending ? "Refreshing" : "Refresh") : undefined}
      onClick={() =>
        startTransition(async () => {
          try {
            await refreshWorkspace();
          } catch {
            toast.error("Could not refresh. Try again.");
          }
        })
      }
    >
      <RefreshCw
        data-icon="inline-start"
        className={cn(pending && "animate-spin")}
      />
      <span className={iconOnly ? "sr-only" : undefined}>{pending ? "Refreshing" : "Refresh"}</span>
    </Button>
  );
}
