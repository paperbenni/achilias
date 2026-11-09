import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OriginalLink } from "./original-link";

export function LiveWriteNotice({ sourceUrl }: { sourceUrl: string }) {
  return (
    <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
      <span className="text-muted-foreground">Read-only mode</span>
      <Button variant="link" size="sm" className="h-auto p-0" asChild>
        <Link href="/settings#preferences">Editing preferences</Link>
      </Button>
      <OriginalLink href={sourceUrl} compact />
    </div>
  );
}
