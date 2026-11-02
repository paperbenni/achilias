"use client";
import { Bookmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ParsedHtmlNotice } from "@/components/navigation/parsed-html-notice";
import { itemKey, typeNames } from "@/lib/ilias/items";
import type { Item } from "@/lib/ilias/types";

/** Details for restricted or not-yet-implemented objects. Files open directly. */
export function ItemDialog({
  item,
  onClose,
  demo,
  instance,
  saved,
  onToggleSave,
}: {
  demo: boolean;
  instance: string;
  item: Item | null;
  onClose: () => void;
  onToggleSave: (item: Item) => void;
  saved: Item[];
}) {
  const limitation = !item?.available
    ? "This item is restricted or unavailable. Check the original ILIAS page for access requirements."
    : demo
      ? "This demo activity uses the original ILIAS interface when connected."
      : `This ${typeNames[item.type]?.toLowerCase() || "activity"} is not supported in Achilias. Open it in ILIAS to use it.`;
  return (
    <Dialog
      open={!!item}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <Badge variant="secondary" className="mb-2 w-fit">
            {item && (typeNames[item.type] || "ILIAS object")}
          </Badge>
          {item?.context && (
            <p className="text-xs text-muted-foreground">{item.context}</p>
          )}
          <DialogTitle>{item?.title}</DialogTitle>
          <DialogDescription>
            {item?.description || limitation}
          </DialogDescription>
        </DialogHeader>
        {item && (
          <div className="flex flex-col gap-5">
            {item.description && (
              <p className="text-sm text-muted-foreground">{limitation}</p>
            )}
            <ParsedHtmlNotice
              feature="item"
              sourceUrl={demo ? instance : item.sourceUrl}
              demo={demo}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => onToggleSave(item)}>
                <Bookmark data-icon="inline-start" />
                {saved.some((i) => itemKey(i) === itemKey(item))
                  ? "Remove bookmark"
                  : "Bookmark"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
