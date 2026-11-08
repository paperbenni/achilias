import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The shared affordance for features that open in the original platform. */
export function OriginalLink({
  href,
  children = "Open in ILIAS",
  compact = false,
}: {
  href: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size={compact ? "sm" : "default"}
      className="h-auto max-w-full whitespace-normal py-2 text-left"
      asChild
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <ArrowUpRight data-icon="inline-end" />
      </a>
    </Button>
  );
}
