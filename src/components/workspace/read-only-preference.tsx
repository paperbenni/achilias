"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Workspace } from "@/lib/ilias/types";

export function ReadOnlyPreference({ data }: { data: Workspace }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [readOnly, setReadOnly] = useOptimistic(data.readOnly !== false);
  return (
    <Card id="preferences">
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Saved in this browser.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={readOnly}
            aria-describedby="read-only-description"
            disabled={pending || data.mode !== "live"}
            onChange={(event) => {
              const nextReadOnly = event.target.checked;
              startTransition(async () => {
                setReadOnly(nextReadOnly);
                try {
                  const response = await fetch("/api/preferences", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", "x-achilias-connection": data.storageKey || "" },
                    body: JSON.stringify({ readOnly: nextReadOnly }),
                  });
                  if (!response.ok) throw new Error((await response.json()).error || "Could not save preference.");
                  router.refresh();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not save preference.");
                }
              });
            }}
          />
          Read-only mode
          {pending && <span role="status" className="font-normal text-muted-foreground">Saving…</span>}
        </label>
        <p id="read-only-description" className="text-sm text-muted-foreground">
          Blocks changes to ILIAS from Achilias, including marking threads read, grades,
          exercise settings and feedback. Turn it off to use supported editing actions.
          Opening ILIAS pages can still record visits or read status.
        </p>
        {data.mode !== "live" && <p className="text-sm text-muted-foreground">Sign in to change this preference. Demo actions stay local.</p>}
      </CardContent>
    </Card>
  );
}
