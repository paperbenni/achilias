"use client";
import { CircleHelp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OriginalLink } from "@/components/navigation/original-link";

/** The shared "the upstream page could not be read" alert. */
export function LoadErrorAlert({
  title,
  error,
  onConnect,
  sourceUrl,
}: {
  title: string;
  error: string;
  onConnect: () => void;
  sourceUrl: string;
}) {
  return (
    <Alert variant="destructive">
      <CircleHelp />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {error}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={onConnect}>
            Reconnect account
          </Button>
          <OriginalLink href={sourceUrl} />
        </div>
      </AlertDescription>
    </Alert>
  );
}
