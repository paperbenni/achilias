"use client";
import { Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OriginalLink } from "@/components/navigation/original-link";
import type { IliasPage } from "@/lib/ilias/types";

/** Explain a readable course/group page that the user has not joined. */
export function GuestMembershipAlert({
  page,
  sourceUrl,
  objectType,
}: {
  page: IliasPage;
  sourceUrl: string;
  objectType?: string;
}) {
  if (page.membership !== "guest") return null;
  const label = objectType === "grp" ? "group" : "course";
  return (
    <Alert className="mb-3">
      <Users />
      <AlertTitle>You’re not a member of this {label}</AlertTitle>
      <AlertDescription>
        <p>
          {page.joinUrl
            ? "You can browse what ILIAS makes public. Join or check your registration status in ILIAS to access exercises, forums, and member-only materials."
            : "You can browse what ILIAS makes public. Contact the organisers or open the original page for access details."}
        </p>
        <div className="mt-3">
          <OriginalLink href={page.joinUrl || sourceUrl} compact>
            {page.joinUrl ? "Open membership in ILIAS" : "Open in ILIAS"}
          </OriginalLink>
        </div>
      </AlertDescription>
    </Alert>
  );
}
