"use client";

import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OriginalLink } from "@/components/navigation/original-link";
import { useBrowserStore } from "@/hooks/use-browser-store";
import {
  ILIAS_REFERENCE_MAJOR,
  iliasCompatibility,
} from "@/lib/ilias/compatibility";
import type { Workspace } from "@/lib/ilias/types";

const decodeDismissed = (value: unknown) => value === true;

export function CompatibilityNotice({ data }: { data: Workspace }) {
  const version = data.page.iliasVersion || data.iliasVersion;
  const { value: dismissed, ready, update } = useBrowserStore(
    `achilias:compatibility:${data.storageKey}:${version}`,
    "sessionStorage",
    decodeDismissed,
    false,
  );
  if (
    data.mode !== "live" ||
    iliasCompatibility(version) !== "unverified" ||
    !ready || dismissed
  )
    return null;
  return (
    <Alert>
      <TriangleAlert />
      <AlertTitle>ILIAS {version} is outside the development reference</AlertTitle>
      <AlertDescription>
        <p>
          Achilias was developed against ILIAS {ILIAS_REFERENCE_MAJOR}. This server
          version is unverified; some features may fail or miss content. Check
          the original page if something looks incomplete.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <OriginalLink href={data.page.sourceUrl} />
          <Button variant="outline" onClick={() => update(() => true)}>
            Dismiss for this session
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
