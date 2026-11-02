"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OriginalLink } from "@/components/navigation/original-link";
import type {
  AssessmentInput,
  AssessmentStatus,
  Submission,
} from "@/lib/ilias/exercise-types";
export function AssessmentEditor({
  submission,
  demo,
  onSave,
  onClose,
}: {
  submission: Submission;
  demo: boolean;
  onSave: (input: AssessmentInput) => Promise<void>;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<AssessmentStatus>(
    submission.status || "notgraded",
  );
  const [mark, setMark] = useState(submission.mark || "");
  const [notice, setNotice] = useState(submission.notice || "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
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
            Assess {submission.name} <Badge variant="outline">HTML-based</Badge>
          </DialogTitle>
          <DialogDescription>
            {demo && "Demo only; changes stay in this browser tab. "}
            {submission.team
              ? "This assessment applies to the whole team shown in ILIAS."
              : "Save the result for this participant and this exercise unit."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              try {
                await onSave({
                  status,
                  ...(submission.mark !== null ? { mark } : {}),
                  ...(submission.notice !== null ? { notice } : {}),
                  version: submission.version,
                });
                toast.success(
                  demo
                    ? "Assessment saved in this demo"
                    : "Assessment verified in ILIAS",
                );
                onClose();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Could not save assessment.",
                );
              }
            });
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="assessment-status">
                Assessment / Bewertung
              </FieldLabel>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as AssessmentStatus)}
                disabled={pending}
              >
                <SelectTrigger id="assessment-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="notgraded">
                      Not assessed / Nicht bewertet
                    </SelectItem>
                    <SelectItem value="passed">Passed / Bestanden</SelectItem>
                    <SelectItem value="failed">
                      Failed / Nicht bestanden
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {submission.mark !== null && (
              <Field>
                <FieldLabel htmlFor="assessment-mark">
                  Mark or points / Note oder Punkte
                </FieldLabel>
                <Input
                  id="assessment-mark"
                  value={mark}
                  onChange={(event) => setMark(event.target.value)}
                  maxLength={32}
                  disabled={pending}
                />
                <FieldDescription>
                  Use your course’s marking format. This is separate from
                  pass/fail status.
                </FieldDescription>
              </Field>
            )}
            {submission.notice !== null && (
              <Field>
                <FieldLabel htmlFor="assessment-notice">
                  Private tutor note / Interne Notiz
                </FieldLabel>
                <Textarea
                  id="assessment-notice"
                  value={notice}
                  onChange={(event) => setNotice(event.target.value)}
                  maxLength={200}
                  disabled={pending}
                />
                <FieldDescription>
                  Internal tutor note, not feedback for the learner. Maximum 200
                  characters.
                </FieldDescription>
              </Field>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>
                {pending && (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                )}
                {pending
                  ? "Saving assessment…"
                  : demo
                    ? "Save demo assessment"
                    : "Save assessment in ILIAS"}
              </Button>
              <OriginalLink href={submission.originalUrl} compact />
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
