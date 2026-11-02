"use client";
import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loadFeedback, sendFeedback } from "@/app/actions/exercises";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OriginalLink } from "@/components/navigation/original-link";
import type { Submission } from "@/lib/ilias/exercise-types";
export function FeedbackEditor({
  exerciseId,
  writeAllowed,
  connection,
  unitId,
  submission,
  demo,
  onSaved,
  onClose,
}: {
  exerciseId: string;
  writeAllowed: boolean;
  connection: string;
  unitId: string;
  submission: Submission;
  demo: boolean;
  onSaved: (feedback: string) => void;
  onClose: () => void;
}) {
  const [editor, setEditor] = useState<{ version: string } | null>(
    demo ? { version: "demo" } : null,
  );
  const [value, setValue] = useState(demo ? submission.feedback || "" : "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    void loadFeedback(exerciseId, unitId, submission.id, connection)
      .then((result) => {
        if (cancelled) return;
        if (result.error || !result.editor)
          setError(result.error || "The original feedback editor is required.");
        else {
          setEditor(result.editor);
          setValue(result.editor.value);
        }
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Could not load learner feedback. Open the original editor.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [demo, exerciseId, unitId, submission.id, connection]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Learner feedback: {submission.name}{" "}
            <Badge variant="outline">HTML-based</Badge>
          </DialogTitle>
          <DialogDescription>
            {demo && "Demo only; no learner is notified. "}
            {submission.team
              ? "Visible to the team. ILIAS may notify its members when you save."
              : "Visible to the learner. ILIAS may send a notification when you save."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!editor || !writeAllowed) return;
            setError("");
            startTransition(async () => {
              try {
                if (!demo) {
                  const result = await sendFeedback(
                    exerciseId,
                    unitId,
                    submission.id,
                    value,
                    editor.version,
                    connection,
                  );
                  if (result.error) throw new Error(result.error);
                }
                onSaved(value);
                toast.success(
                  demo
                    ? "Feedback saved in this demo"
                    : "Learner feedback verified in ILIAS",
                );
                onClose();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Could not send feedback.",
                );
              }
            });
          }}
        >
          <FieldGroup>
            {!writeAllowed && (
              <Alert>
                <AlertDescription>
                  Live feedback changes are disabled for this exercise. You can
                  read the current feedback here; use the original ILIAS editor
                  to change it.
                </AlertDescription>
              </Alert>
            )}
            {!editor && !error && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading the current feedback…
              </p>
            )}
            <Field>
              <FieldLabel htmlFor="learner-feedback">
                Feedback for the learner / Rückmeldung
              </FieldLabel>
              <Textarea
                id="learner-feedback"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                maxLength={4000}
                rows={8}
                disabled={!editor || pending || !writeAllowed}
              />
              <FieldDescription>
                Maximum 4,000 characters. Use the assessment editor for private
                tutor notes.
              </FieldDescription>
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={!editor || pending || !writeAllowed}
              >
                {pending && (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                )}
                {pending
                  ? "Saving feedback…"
                  : demo
                    ? "Save demo feedback"
                    : "Send learner feedback"}
              </Button>
              <OriginalLink href={submission.originalUrl} compact>
                Original feedback editor
              </OriginalLink>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
