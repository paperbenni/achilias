"use client";
import { LayoutGrid, List } from "lucide-react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

/** Grid/list switch shared by the course sections and the browse materials tab. */
export function LayoutToggle({
  layout,
  onLayoutChange,
}: {
  layout: string;
  onLayoutChange: (value: string) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={layout}
      onValueChange={(v) => v && onLayoutChange(v)}
      variant="outline"
      spacing={0}
      aria-label="Content layout"
    >
      <ToggleGroupItem value="grid" aria-label="Grid view">
        <LayoutGrid />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List view">
        <List />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
