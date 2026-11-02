import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OriginalLink } from "./original-link";
export function LiveWriteNotice({ sourceUrl }: { sourceUrl: string }) {
  return (
    <Alert role="note">
      <AlertTitle>Live changes disabled</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          Grades, exercise settings, learner feedback and explicit mark-as-read
          actions are protected. Live editing has not been enabled for this
          object. You can browse here and make changes in the original
          interface. Browsing ILIAS can still record visits or read status.
        </p>
        <div>
          <OriginalLink href={sourceUrl} />
        </div>
      </AlertDescription>
    </Alert>
  );
}
