"use client";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/browser-download";
export function SubmissionDownload({
  href,
  name,
}: {
  href: string;
  name: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await downloadFile(href, name);
          toast.success("Submission download ready");
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not download the submission.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? (
        <Loader2 data-icon="inline-start" className="animate-spin" />
      ) : (
        <Download data-icon="inline-start" />
      )}
      {pending ? "Preparing download…" : "Download submission"}
    </Button>
  );
}
