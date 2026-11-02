import type { Workspace } from "./types";
import type { AssessmentStatus } from "./exercise-validation";
export type {
  AssessmentStatus,
  AssessmentInput,
  UnitInput,
} from "./exercise-validation";
export type ExerciseUnit = {
  id: string;
  title: string;
  type: string;
  start: string;
  deadline: string;
  mandatory: string;
  instructions: string;
  sourceUrl: string;
  editUrl?: string;
};
export type Submission = {
  id: string;
  name: string;
  login: string;
  team: boolean;
  submitted: string | null;
  late: boolean | null;
  status: AssessmentStatus | null;
  mark: string | null;
  notice: string | null;
  feedback: string | null;
  downloadUrl?: string;
  feedbackUrl?: string;
  originalUrl: string;
  canAssess: boolean;
  version: string;
};
export type UnitSettings = {
  title: string;
  instruction: string;
  instructionText: string;
  start: string;
  deadlineMode: string;
  deadline: string;
  lateDeadline: string;
  mandatory: boolean;
  version: string;
  canEdit: boolean;
  limitation?: string;
};
export type ExerciseState = {
  writeAllowed: boolean;
  workspace: Workspace;
  exerciseId: string;
  unitId?: string;
  creating: boolean;
  units: ExerciseUnit[];
  submissions: Submission[];
  submissionsKnown: boolean;
  settings: UnitSettings | null;
  canCreate: boolean;
  tutor: boolean;
  recognized: boolean;
  hasMore: boolean;
  sourceUrl: string;
};
export function exerciseHref(
  exerciseId: string,
  demo = false,
  unitId?: string,
) {
  return `/exercises/${exerciseId}${unitId ? `/units/${unitId}` : ""}${demo ? "?demo=1" : ""}`;
}

export function submissionCounts(rows: Submission[], known: boolean) {
  const submitted = (row: Submission) => !!row.submitted || !!row.downloadUrl;
  return {
    all: known ? rows.length : null,
    review:
      known && !rows.some((row) => submitted(row) && row.status === null)
        ? rows.filter((row) => submitted(row) && row.status === "notgraded")
            .length
        : null,
    missing:
      known && !rows.some((row) => row.submitted === null && !row.downloadUrl)
        ? rows.filter((row) => row.submitted === "" && !row.downloadUrl).length
        : null,
    late:
      known && !rows.some((row) => row.late === null)
        ? rows.filter((row) => row.late).length
        : null,
  };
}
