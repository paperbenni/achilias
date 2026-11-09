"use client";

import { useBrowserStore } from "@/hooks/use-browser-store";
import { decodeItemSort, itemSortOptions, type ItemSort } from "@/lib/ilias/item-sort";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const decodeMaterialSort = (value: unknown) => decodeItemSort(value, "source");

export function useItemSortPreference(storageKey: string, kind: "courses" | "materials") {
  const { value, update } = useBrowserStore(
    `achilias:${storageKey}:${kind}-sort:v1`, "localStorage", kind === "courses" ? decodeItemSort : decodeMaterialSort,
    kind === "courses" ? "frecency" : "source",
  );
  return { sort: value, onSortChange: (value: string) => update(() => decodeItemSort(value)) };
}

export function SortControl({ sort, onSortChange, label }: {
  sort: ItemSort; onSortChange: (value: string) => void; label: string;
}) {
  return (
    <Select value={sort} onValueChange={onSortChange}>
      <SelectTrigger aria-label={label} className="max-w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {itemSortOptions.map(([value, label]) => (
          <SelectItem key={value} value={value}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SortDescription({ sort }: { sort: ItemSort }) {
  if (!["frecency", "recent", "frequent"].includes(sort)) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {sort === "frecency" ? "Frequent and recent opens rank higher; older activity fades. " : ""}
      Based on items you open in this browser.
    </p>
  );
}
