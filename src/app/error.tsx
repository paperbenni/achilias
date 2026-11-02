"use client";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>We couldn’t open your learning space.</EmptyTitle>
          <EmptyDescription>
            Try again in a moment. Your materials are still on ILIAS.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <a href="/">Back to overview</a>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
