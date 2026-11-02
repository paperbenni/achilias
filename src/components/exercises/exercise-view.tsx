"use client";
import { LiveWriteNotice } from "@/components/navigation/live-write-notice";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  MessageSquare,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Item,
  ItemGroup,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { OriginalLink } from "@/components/navigation/original-link";
import { RefreshButton } from "@/components/navigation/refresh-button";
import { useBrowserStore } from "@/hooks/use-browser-store";
import { assessSubmission, updateExerciseUnit } from "@/app/actions/exercises";
import {
  exerciseHref,
  hasSubmission,
  submissionCounts,
  type AssessmentInput,
  type ExerciseState,
  type Submission,
  type UnitInput,
  type UnitSettings,
} from "@/lib/ilias/exercise-types";
import {
  decodeExerciseDemo,
  emptyExerciseDemo,
  type DemoAssessment,
} from "@/lib/ilias/exercise-demo-store";
import {
  assessmentProblem,
  unitProblem,
} from "@/lib/ilias/exercise-validation";
import { AssessmentEditor } from "./assessment-editor";
import { FeedbackEditor } from "./feedback-editor";
import { SubmissionDownload } from "./submission-download";
import { UnitEditor } from "./unit-editor";
const statusLabels = {
  notgraded: "Not assessed",
  passed: "Passed",
  failed: "Failed",
};
export function ExerciseView({ state }: { state: ExerciseState }) {
  const router = useRouter();
  const { exerciseId, unitId, workspace, creating } = state;
  const demo = workspace.mode === "demo";
  const { value: changes, update } = useBrowserStore(
    "achilias:demo:exercises:v1",
    "sessionStorage",
    decodeExerciseDemo,
    emptyExerciseDemo,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [assessment, setAssessment] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState<Submission | null>(null);
  const units = new Map(state.units.map((unit) => [unit.id, unit]));
  if (demo)
    for (const [id, settings] of Object.entries(changes.units)) {
      const existing = units.get(id);
      units.set(id, {
        id,
        title: settings.title,
        type: existing?.type || "File submission",
        start: settings.start,
        deadline:
          settings.deadlineMode === "-1" ? "No deadline" : settings.deadline,
        mandatory: settings.mandatory ? "Yes" : "No",
        instructions: "",
        sourceUrl: workspace.instance,
        editUrl: workspace.instance,
      });
    }
  const unit = unitId ? units.get(unitId) : undefined;
  const settings = (demo && unitId && changes.units[unitId]) || state.settings;
  const submissions = state.submissions.map((row) => {
    const override =
      demo && unitId ? changes.assessments[`${unitId}:${row.id}`] : undefined;
    return override
      ? ({
          ...row,
          ...Object.fromEntries(
            Object.entries(override).filter(([, value]) => value !== undefined),
          ),
        } as Submission)
      : row;
  });
  const pending = submissions.filter(
    (row) => hasSubmission(row) && row.status === "notgraded",
  );
  const missing = submissions.filter(
    (row) => row.submitted === "" && !row.downloadUrl,
  );
  const counts = submissionCounts(submissions, state.submissionsKnown);
  const filtered = submissions.filter(
    (row) =>
      `${row.name} ${row.login} ${row.mark || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "review" && pending.includes(row)) ||
        (filter === "missing" && missing.includes(row)) ||
        (filter === "late" && row.late)),
  );
  function saveDemoAssessment(memberId: string, change: DemoAssessment) {
    if (
      !update((current) => ({
        ...current,
        assessments: {
          ...current.assessments,
          [`${unitId}:${memberId}`]: {
            ...current.assessments[`${unitId}:${memberId}`],
            ...change,
          },
        },
      }))
    )
      throw new Error("Your browser could not save this demo change.");
  }
  async function saveUnit(input: UnitInput) {
    const problem = unitProblem(input);
    if (problem) throw new Error(problem);
    if (!demo) {
      const result = await updateExerciseUnit(
        exerciseId,
        unitId,
        input,
        workspace.storageKey || "",
      );
      if (result.error || !result.saved)
        throw new Error(result.error || "Could not save unit.");
      if (creating)
        router.push(exerciseHref(exerciseId, false, result.saved.unitId));
      return;
    }
    const id = unitId || String(Date.now() % 100_000_000_000);
    const saved: UnitSettings = {
      title: input.title,
      instruction: settings?.instruction || "",
      instructionText: input.instruction ?? settings?.instructionText ?? "",
      start: input.start,
      deadlineMode: input.deadlineMode,
      deadline: input.deadline,
      lateDeadline: input.lateDeadline,
      mandatory: input.mandatory,
      version: String(Date.now()),
      canEdit: true,
    };
    if (
      !update((current) => ({
        ...current,
        units: { ...current.units, [id]: saved },
      }))
    )
      throw new Error("Your browser could not save this demo unit.");
    if (creating) router.push(exerciseHref(exerciseId, true, id));
  }
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="w-fit" asChild>
          <Link
            href={
              unitId || creating
                ? exerciseHref(exerciseId, demo)
                : demo
                  ? "/browse/crs/101?demo=1"
                  : "/"
            }
            prefetch={demo}
          >
            <ArrowLeft data-icon="inline-start" />
            {unitId || creating
              ? "All exercise units"
              : "Back to your learning space"}
          </Link>
        </Button>
        <RefreshButton />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {unitId ? "ABGABEN & BEWERTUNG" : "ÜBUNGEN · TUTOR WORKSPACE"}
          </p>
          <h1 className="page-title mt-3">
            {creating
              ? "New exercise unit"
              : unit?.title || workspace.page.title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {unitId
              ? `${unit?.type || "Exercise unit"} · Deadline: ${unit?.deadline || "Not shown by ILIAS"}`
              : "Exercise units, submissions, and the next thing that needs your attention."}
          </p>
        </div>
        {!unitId && !creating && state.canCreate && (
          <Button asChild>
            <Link href={exerciseHref(exerciseId, demo, "new")} prefetch={false}>
              <Plus data-icon="inline-start" />
              New exercise unit
            </Link>
          </Button>
        )}
      </div>
      {!state.writeAllowed && <LiveWriteNotice sourceUrl={state.sourceUrl} />}
      {!state.recognized && (
        <Alert>
          <AlertTitle>This exercise layout needs the original page</AlertTitle>
          <AlertDescription>
            The available units or tutor controls could not be recognized. No
            missing result is treated as a zero or a failed submission.
            <div className="mt-3">
              <OriginalLink href={state.sourceUrl} />
            </div>
          </AlertDescription>
        </Alert>
      )}
      {!state.tutor && !creating && (
        <Alert>
          <AlertTitle>Tutor controls are not available here</AlertTitle>
          <AlertDescription>
            ILIAS has not offered a submissions overview to this account. You
            can browse visible units; learner submission and advanced
            permissions use the original interface.
            <div className="mt-3">
              <OriginalLink href={state.sourceUrl} />
            </div>
          </AlertDescription>
        </Alert>
      )}
      {creating ? (
        <UnitEditor
          key={settings?.version}
          settings={
            settings && !state.writeAllowed
              ? {
                  ...settings,
                  canEdit: false,
                  limitation:
                    "Live changes are disabled for this exercise. Use the original ILIAS editor.",
                }
              : settings
          }
          creating
          demo={demo}
          sourceUrl={state.sourceUrl}
          onSave={saveUnit}
        />
      ) : !unitId ? (
        <ItemGroup aria-label="Exercise units">
          {[...units.values()].map((unit) => (
            <Item
              key={unit.id}
              variant="outline"
              role="listitem"
              className="flex-wrap"
            >
              <ItemMedia variant="icon">
                <ClipboardList />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle>
                  <Link
                    href={exerciseHref(exerciseId, demo, unit.id)}
                    prefetch={demo}
                  >
                    {unit.title}
                  </Link>
                </ItemTitle>
                <ItemDescription>
                  {unit.type || "Type not shown"} · Deadline:{" "}
                  {unit.deadline || "Not shown by ILIAS"}
                  {unit.start && ` · Opens: ${unit.start}`}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge variant="outline">
                  {unit.mandatory
                    ? `Required: ${unit.mandatory}`
                    : "Requirement not shown"}
                </Badge>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={exerciseHref(exerciseId, demo, unit.id)}
                    prefetch={demo}
                  >
                    {state.tutor ? "Review submissions" : "View unit"}
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </ItemActions>
            </Item>
          ))}
          {units.size === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No exercise units found</EmptyTitle>
                <EmptyDescription>
                  Create a file-submission unit if your account has editing
                  access, or check the original exercise.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </ItemGroup>
      ) : (
        <Tabs defaultValue={state.tutor ? "submissions" : "instructions"}>
          <TabsList className="max-w-full">
            <TabsTrigger value="submissions">
              <span className="hidden sm:inline">Submissions / Abgaben</span>
              <span className="sm:hidden">Abgaben</span>
            </TabsTrigger>
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
            <TabsTrigger value="settings">Unit settings</TabsTrigger>
          </TabsList>
          <TabsContent value="instructions" className="mt-5">
            <Card>
              <CardHeader>
                <CardTitle>Work instructions</CardTitle>
                <CardDescription>
                  Start: {unit?.start || "Not shown"} · Requirement:{" "}
                  {unit?.mandatory || "Not shown"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {demo && unitId && changes.units[unitId] ? (
                  <p className="whitespace-pre-wrap text-sm">
                    {changes.units[unitId].instructionText ||
                      "No instructions provided."}
                  </p>
                ) : unit?.instructions ? (
                  <div
                    className="forum-prose"
                    dangerouslySetInnerHTML={{ __html: unit.instructions }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No readable instructions were offered. Open ILIAS for the
                    full unit and its files.
                  </p>
                )}
              </CardContent>
              <CardFooter>
                <OriginalLink
                  href={unit?.editUrl || unit?.sourceUrl || state.sourceUrl}
                />
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="settings" className="mt-5">
            <UnitEditor
              key={`${unitId}:${settings?.version}`}
              settings={
                settings && !state.writeAllowed
                  ? {
                      ...settings,
                      canEdit: false,
                      limitation:
                        "Live changes are disabled for this exercise. Use the original ILIAS editor.",
                    }
                  : settings
              }
              creating={false}
              demo={demo}
              sourceUrl={unit?.editUrl || state.sourceUrl}
              onSave={saveUnit}
            />
          </TabsContent>
          <TabsContent value="submissions" className="mt-5">
            <div className="flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Needs assessment", counts.review ?? "—"],
                  ["Missing submissions", counts.missing ?? "—"],
                  ["Late submissions", counts.late ?? "—"],
                ].map(([title, count]) => (
                  <Card key={title} size="sm">
                    <CardHeader>
                      <CardDescription>{title}</CardDescription>
                      <CardTitle>{count}</CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ToggleGroup
                  type="single"
                  value={filter}
                  onValueChange={(value) => value && setFilter(value)}
                  variant="outline"
                  className="flex-wrap justify-start"
                  aria-label="Submission filter"
                  disabled={!state.submissionsKnown}
                >
                  <ToggleGroupItem value="all">
                    All {counts.all ?? "—"}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="review">
                    Needs assessment {counts.review ?? "—"}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="missing"
                    disabled={counts.missing === null}
                  >
                    Missing {counts.missing ?? "—"}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="late" disabled={counts.late === null}>
                    Late {counts.late ?? "—"}
                  </ToggleGroupItem>
                </ToggleGroup>
                <div className="w-full sm:w-72">
                  <InputGroup>
                    <InputGroupAddon>
                      <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-label="Search submissions"
                      disabled={!state.submissionsKnown}
                      placeholder="Find a participant or team…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </InputGroup>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Counts and search cover the rows loaded from ILIAS, including
                any upstream filters. Missing columns remain unknown.{" "}
                {state.hasMore &&
                  "More rows or pagination controls exist in the original view."}
              </p>
              <ItemGroup aria-label="Participant submissions">
                {filtered.map((row) => (
                  <Item
                    key={row.id}
                    variant="outline"
                    role="listitem"
                    className="items-start"
                  >
                    <ItemMedia variant="icon">
                      <Users />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="max-w-full line-clamp-none">
                        {row.name}
                      </ItemTitle>
                      <ItemDescription>
                        {row.login}
                        {row.login && " · "}
                        {row.submitted ||
                          (row.downloadUrl
                            ? "Submission available"
                            : row.submitted === null
                              ? "Submission date not shown"
                              : "No submission recorded")}
                      </ItemDescription>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={
                            row.status === "passed" ? "secondary" : "outline"
                          }
                        >
                          {row.status
                            ? statusLabels[row.status]
                            : "Assessment not shown"}
                        </Badge>
                        {row.mark && (
                          <Badge variant="secondary">{row.mark}</Badge>
                        )}
                        {row.late && (
                          <Badge variant="outline">Late / Verspätet</Badge>
                        )}
                        {row.team && (
                          <Badge variant="outline">Team assessment</Badge>
                        )}
                      </div>
                      {row.notice && (
                        <p className="text-xs text-muted-foreground">
                          Private note: {row.notice}
                        </p>
                      )}
                      {row.feedback && (
                        <p className="text-xs text-muted-foreground">
                          Learner feedback: {row.feedback}
                        </p>
                      )}
                    </ItemContent>
                    <ItemActions className="flex-wrap">
                      {row.downloadUrl && (
                        <SubmissionDownload
                          href={
                            demo
                              ? "/api/files/301?demo=1"
                              : `/api/exercises/${exerciseId}/units/${unitId}/submissions/${row.id}`
                          }
                          name={`submission-${row.id}.zip`}
                        />
                      )}
                      {row.canAssess && (
                        <Button
                          size="sm"
                          disabled={!state.writeAllowed}
                          onClick={() => setAssessment(row)}
                        >
                          Assess
                        </Button>
                      )}
                      {row.feedbackUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFeedback(row)}
                        >
                          <MessageSquare data-icon="inline-start" />
                          Learner feedback
                        </Button>
                      )}
                    </ItemActions>
                  </Item>
                ))}
                {filtered.length === 0 && (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>
                        {!state.submissionsKnown
                          ? "Could not read submissions"
                          : submissions.length
                            ? "No matching submissions"
                            : "No participant rows available"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {submissions.length
                          ? "Try another filter or search term."
                          : "This can mean no participants, missing permissions, or an unsupported layout. Check the original submissions page."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </ItemGroup>
              <div>
                <OriginalLink href={state.sourceUrl}>
                  All submissions and advanced tools in ILIAS
                </OriginalLink>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
      <Alert>
        <AlertTitle>Keep the full exercise within reach</AlertTitle>
        <AlertDescription>
          File uploads and learner submissions, feedback attachments, peer
          review, individual or relative deadlines, team membership, bulk
          downloads, and deleting units use the original ILIAS interface. Native
          unit creation currently supports file-submission units.
          <div className="mt-3">
            <OriginalLink href={state.sourceUrl} />
          </div>
        </AlertDescription>
      </Alert>
      {assessment && unitId && (
        <AssessmentEditor
          key={`${assessment.id}:${assessment.version}`}
          submission={assessment}
          demo={demo}
          onClose={() => setAssessment(null)}
          onSave={async (input: AssessmentInput) => {
            const problem = assessmentProblem(input);
            if (problem) throw new Error(problem);
            if (demo) saveDemoAssessment(assessment.id, input);
            else {
              const result = await assessSubmission(
                exerciseId,
                unitId,
                assessment.id,
                input,
                workspace.storageKey || "",
              );
              if (result.error) throw new Error(result.error);
            }
          }}
        />
      )}
      {feedback && unitId && (
        <FeedbackEditor
          key={feedback.id}
          exerciseId={exerciseId}
          connection={workspace.storageKey || ""}
          unitId={unitId}
          submission={feedback}
          writeAllowed={state.writeAllowed}
          demo={demo}
          onClose={() => setFeedback(null)}
          onSaved={(value) => {
            if (demo) saveDemoAssessment(feedback.id, { feedback: value });
          }}
        />
      )}
    </div>
  );
}
