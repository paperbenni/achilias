"use client";

import type { RefObject } from "react";
import { usePageShortcuts } from "@/hooks/use-page-shortcuts";

export function useResourceShortcuts(root: RefObject<HTMLDivElement | null>, enabled: boolean) {
  usePageShortcuts((event) => {
    if (!enabled || !["h", "j", "k", "l"].includes(event.key)) return;
    // Only primary resource actions belong to this page's navigation. Toolbars,
    // previews and bookmark buttons keep their normal Tab order.
    const resources = Array.from(root.current?.querySelectorAll<HTMLElement>(
      ".course-card, .resource-row",
    ) || []).filter((element) => element.getBoundingClientRect().width > 0);
    const rows: HTMLElement[][] = [];
    for (const resource of resources) {
      const previous = rows.at(-1);
      if (previous && Math.abs(previous[0].getBoundingClientRect().top - resource.getBoundingClientRect().top) < 2) {
        previous.push(resource);
      } else rows.push([resource]);
    }
    if (!rows.length) return;
    const rowIndex = rows.findIndex((row) => row.some((element) => element.contains(document.activeElement)));
    let next = rows[0][0];
    if (rowIndex >= 0) {
      const row = rows[rowIndex];
      const column = row.findIndex((element) => element.contains(document.activeElement));
      next = row[column];
      if (event.key === "h" || event.key === "l") {
        next = row[column + (event.key === "h" ? -1 : 1)] || next;
      } else {
        const adjacent = rows[rowIndex + (event.key === "k" ? -1 : 1)];
        if (adjacent) {
          const x = next.getBoundingClientRect().left;
          next = adjacent.reduce((best, element) =>
            Math.abs(element.getBoundingClientRect().left - x) < Math.abs(best.getBoundingClientRect().left - x) ? element : best);
        }
      }
    }
    const action = next.querySelector<HTMLElement>(".resource-primary");
    if (!action) return;
    event.preventDefault();
    action.focus({ preventScroll: true });
    next.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}
