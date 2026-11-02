import type { AssessmentStatus, UnitSettings } from "./exercise-types";
export type DemoAssessment = {
  status?: AssessmentStatus;
  mark?: string;
  notice?: string;
  feedback?: string;
};
export type ExerciseDemoStore = {
  units: Record<string, UnitSettings>;
  assessments: Record<string, DemoAssessment>;
};
export const emptyExerciseDemo: ExerciseDemoStore = {
  units: {},
  assessments: {},
};
export function decodeExerciseDemo(value: unknown): ExerciseDemoStore {
  if (!value || typeof value !== "object") return emptyExerciseDemo;
  const data = value as Record<string, unknown>;
  const result: ExerciseDemoStore = { units: {}, assessments: {} };
  if (data.units && typeof data.units === "object")
    for (const [key, raw] of Object.entries(data.units)) {
      if (!/^\d{1,12}$/.test(key) || !raw || typeof raw !== "object") continue;
      const unit = raw as UnitSettings;
      if (
        ![
          unit.title,
          unit.instruction,
          unit.instructionText,
          unit.start,
          unit.deadlineMode,
          unit.deadline,
          unit.lateDeadline,
          unit.version,
        ].every(
          (value) => typeof value === "string" && value.length < 100_001,
        ) ||
        typeof unit.mandatory !== "boolean"
      )
        continue;
      result.units[key] = { ...unit, canEdit: true };
    }
  if (data.assessments && typeof data.assessments === "object")
    for (const [key, raw] of Object.entries(data.assessments)) {
      if (!/^\d{1,12}:\d{1,12}$/.test(key) || !raw || typeof raw !== "object")
        continue;
      const row = raw as DemoAssessment;
      if (
        row.status !== undefined &&
        !["notgraded", "passed", "failed"].includes(row.status)
      )
        continue;
      if (
        [row.mark, row.notice, row.feedback].some(
          (value) =>
            value !== undefined &&
            (typeof value !== "string" || value.length > 4000),
        )
      )
        continue;
      result.assessments[key] = {
        status: row.status,
        mark: row.mark,
        notice: row.notice,
        feedback: row.feedback,
      };
    }
  return result;
}
