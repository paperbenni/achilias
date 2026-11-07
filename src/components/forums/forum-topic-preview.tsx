"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The overview already knows the first post for demo content and for previews
 * cached on the server. Live previews load when the card approaches the
 * viewport, so opening a forum does not block on every discussion page.
 */
export function ForumTopicPreview({
  forumId,
  threadId,
  connection,
  initialPreview,
}: {
  forumId: string;
  threadId: string;
  connection?: string;
  initialPreview?: string;
}) {
  const [preview, setPreview] = useState<string | undefined>(initialPreview);
  const [loading, setLoading] = useState(
    initialPreview === undefined && !!connection,
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preview !== undefined || !connection) return;
    const connectionKey = connection;
    const element = ref.current;
    if (!element) return;
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `/api/forums/${forumId}/threads/${threadId}/preview`,
          {
            method: "POST",
            headers: { "x-achilias-connection": connectionKey },
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) return;
        const body = (await response.json().catch(() => ({}))) as {
          preview?: string | null;
        };
        if (!cancelled) setPreview(body.preview || "");
      } catch {
        // A preview is optional; the card still opens the discussion.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (typeof IntersectionObserver === "undefined") {
      void load();
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void load();
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      controller.abort();
      observer.disconnect();
    };
  }, [connection, forumId, preview, threadId]);

  if (!preview && !(loading && connection)) return null;
  return (
    <div ref={ref}>
      {preview ? (
        <p className="line-clamp-3 text-sm leading-relaxed break-words text-muted-foreground">
          {preview}
        </p>
      ) : (
        <Skeleton aria-hidden className="h-10" />
      )}
    </div>
  );
}
