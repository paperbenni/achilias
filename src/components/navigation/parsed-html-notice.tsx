import { FileCode2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { OriginalLink } from "./original-link";

const features = {
  connection: {
    title: "Connection verification",
    details: "Sign-in detection and session verification read ILIAS HTML.",
  },
  dashboard: {
    title: "Course listings",
    details:
      "Course names, details, and availability are read from ILIAS HTML.",
  },
  materials: {
    title: "Materials and course details",
    details:
      "Materials, availability, course information, and tool links are read from ILIAS HTML.",
  },
  forum: {
    title: "Forum content and read status",
    details:
      "Discussions, posts, counts, attachment and reply links, and read-status controls are read from ILIAS HTML.",
  },
  item: {
    title: "Item details",
    details:
      "This item's name, details, and availability are read from ILIAS HTML.",
  },
};

/** Keep the parser limitation and an escape to the source together, even on errors. */
export function ParsedHtmlNotice({
  feature,
  sourceUrl,
  demo = false,
}: {
  feature: keyof typeof features;
  sourceUrl: string;
  demo?: boolean;
}) {
  const { title, details } = features[feature];
  return (
    <Alert role="note" aria-label={`${title}: HTML-based feature`}>
      <FileCode2 />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        {title}
        <Badge variant="outline">HTML-based</Badge>
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          {demo
            ? `In a connected account, ${details.charAt(0).toLowerCase()}${details.slice(1)}`
            : details}{" "}
          ILIAS or theme updates can make this feature incomplete or incorrect.
          {demo && " The content shown here is an example."}
        </p>
        <div>
          <OriginalLink href={sourceUrl} compact>
            {demo ? "Visit ILIAS" : "Open original in ILIAS"}
          </OriginalLink>
        </div>
      </AlertDescription>
    </Alert>
  );
}
