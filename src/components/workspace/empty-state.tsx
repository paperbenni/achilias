"use client";
import { BookOpen } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { OriginalLink } from "@/components/navigation/original-link";

/** The shared empty-state block for filtered-out or missing lists. */
export function EmptyState({
  title,
  description,
  showOriginal,
  sourceUrl,
}: {
  title: string;
  description: string;
  showOriginal: boolean;
  sourceUrl: string;
}) {
  return (
    <Empty className="min-h-48 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BookOpen />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {showOriginal && (
        <EmptyContent>
          <OriginalLink href={sourceUrl}>Check in ILIAS</OriginalLink>
        </EmptyContent>
      )}
    </Empty>
  );
}
