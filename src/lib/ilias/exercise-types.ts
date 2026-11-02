import type { Workspace } from "./types";
export type AssessmentStatus = "notgraded" | "passed" | "failed";
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
  late: boolean;
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
  workspace: Workspace;
  exerciseId: string;
  unitId?: string;
  creating: boolean;
  units: ExerciseUnit[];
  submissions: Submission[];
  settings: UnitSettings | null;
  canCreate: boolean;
  tutor: boolean;
  recognized: boolean;
  hasMore: boolean;
  sourceUrl: string;
};
export type AssessmentInput = {
  status: AssessmentStatus;
  mark?: string;
  notice?: string;
  version: string;
};
export type UnitInput = {
  title: string;
  instruction?: string;
  start: string;
  deadlineMode: "-1" | "0";
  deadline: string;
  lateDeadline: string;
  mandatory: boolean;
  version: string;
};
export function exerciseHref(
  exerciseId: string,
  demo = false,
  unitId?: string,
) {
  return `/exercises/${exerciseId}${unitId ? `/units/${unitId}` : ""}${demo ? "?demo=1" : ""}`;
}
