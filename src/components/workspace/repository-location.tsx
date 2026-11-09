"use client";

import Link from "next/link";
import { FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkspaceCrumb } from "@/lib/ilias/breadcrumbs";

/** Repository ancestors are useful context, not the user's navigation path. */
export function RepositoryLocation({ crumbs }: { crumbs: WorkspaceCrumb[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground"
          aria-label="Show ILIAS location"
          title="Show ILIAS location"
        >
          <FolderTree />
          <span className="hidden lg:inline">ILIAS location</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 max-w-[min(90vw,24rem)] overflow-y-auto">
        <DropdownMenuLabel>ILIAS location</DropdownMenuLabel>
        {crumbs.map((crumb, index) => (
          <DropdownMenuItem key={index} asChild={!!crumb.href} disabled={!crumb.href}>
            {crumb.href ? <Link href={crumb.href} prefetch={false} className="whitespace-normal">{crumb.title}</Link> : <span>{crumb.title}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
