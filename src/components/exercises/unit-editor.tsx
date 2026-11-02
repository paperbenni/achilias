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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { OriginalLink } from "@/components/navigation/original-link";
import type { UnitInput, UnitSettings } from "@/lib/ilias/exercise-types";
export function UnitEditor({
  settings,
  creating,
  demo,
  sourceUrl,
  onSave,
}: {
  settings: UnitSettings | null;
  creating: boolean;
  demo: boolean;
  sourceUrl: string;
  onSave: (input: UnitInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(settings?.title || "");
  const [instruction, setInstruction] = useState(
    settings?.instructionText || "",
  );
  const [start, setStart] = useState(settings?.start || "");
  const [deadlineMode, setDeadlineMode] = useState(
    settings?.deadlineMode === "-1" ? "-1" : "0",
  );
  const [deadline, setDeadline] = useState(settings?.deadline || "");
  const [lateDeadline, setLateDeadline] = useState(
    settings?.lateDeadline || "",
  );
  const [mandatory, setMandatory] = useState(settings?.mandatory || false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {creating
            ? "New file-submission unit"
            : "Unit settings / Übungseinheit"}
          <Badge variant="outline">HTML-based</Badge>
        </CardTitle>
        <CardDescription>
          {demo && "Demo changes stay in this browser tab. "}Dates use your
          ILIAS profile’s timezone, as shown by the original editor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!settings?.canEdit ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {settings?.limitation ||
                "ILIAS has not offered a supported editor to this account. Use the original for this unit’s settings."}
            </p>
            <div>
              <OriginalLink href={sourceUrl}>
                Open unit settings in ILIAS
              </OriginalLink>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              startTransition(async () => {
                try {
                  await onSave({
                    title,
                    ...(creating || instruction !== settings.instructionText
                      ? { instruction }
                      : {}),
                    start,
                    deadlineMode: deadlineMode as "-1" | "0",
                    deadline,
                    lateDeadline,
                    mandatory,
                    version: settings.version,
                  });
                  toast.success(
                    demo
                      ? "Unit saved in this demo"
                      : "Exercise unit verified in ILIAS",
                  );
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Could not save unit.",
                  );
                }
              });
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="unit-title">Title / Titel</FieldLabel>
                <Input
                  id="unit-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  required
                  disabled={pending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="unit-instruction">
                  Instructions / Arbeitsanweisung
                </FieldLabel>
                <Textarea
                  id="unit-instruction"
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  rows={5}
                  disabled={pending}
                />
                <FieldDescription>
                  Edits here use plain text. Leaving instructions unchanged
                  preserves their rich formatting. Files and advanced content
                  use the original editor.
                </FieldDescription>
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="unit-start">Start / Freigabe</FieldLabel>
                  <Input
                    id="unit-start"
                    type="datetime-local"
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="unit-deadline-mode">
                    Submission deadline / Abgabefrist
                  </FieldLabel>
                  <Select
                    value={deadlineMode}
                    onValueChange={setDeadlineMode}
                    disabled={pending}
                  >
                    <SelectTrigger id="unit-deadline-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="0">Fixed deadline</SelectItem>
                        <SelectItem value="-1">No deadline</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {deadlineMode === "0" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="unit-deadline">
                      Deadline / Abgabetermin
                    </FieldLabel>
                    <Input
                      id="unit-deadline"
                      type="datetime-local"
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                      required
                      disabled={pending}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="unit-late-deadline">
                      Late submissions until / Nachfrist
                    </FieldLabel>
                    <Input
                      id="unit-late-deadline"
                      type="datetime-local"
                      value={lateDeadline}
                      onChange={(event) => setLateDeadline(event.target.value)}
                      disabled={pending}
                    />
                    <FieldDescription>
                      Optional. The original exercise controls whether late
                      submissions are allowed.
                    </FieldDescription>
                  </Field>
                </div>
              )}
              <Field>
                <FieldLabel>Completion requirement / Verpflichtend</FieldLabel>
                <ToggleGroup
                  type="single"
                  value={mandatory ? "required" : "optional"}
                  onValueChange={(value) => {
                    if (value) setMandatory(value === "required");
                  }}
                  variant="outline"
                  disabled={pending}
                  aria-label="Completion requirement"
                >
                  <ToggleGroupItem value="required">
                    Required / Verpflichtend
                  </ToggleGroupItem>
                  <ToggleGroupItem value="optional">Optional</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>
                  {pending && (
                    <Loader2
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  )}
                  {pending
                    ? "Saving unit…"
                    : demo
                      ? creating
                        ? "Create demo unit"
                        : "Save demo unit"
                      : creating
                        ? "Create unit in ILIAS"
                        : "Save unit in ILIAS"}
                </Button>
                <OriginalLink href={sourceUrl} compact>
                  Original unit editor
                </OriginalLink>
              </div>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
