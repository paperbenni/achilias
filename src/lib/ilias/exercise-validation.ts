import type { AssessmentInput, UnitInput } from "./exercise-types";
export function assessmentProblem(value: AssessmentInput) {
  if (
    !value ||
    !["notgraded", "passed", "failed"].includes(value.status) ||
    typeof value.version !== "string" ||
    (value.mark !== undefined &&
      (typeof value.mark !== "string" || value.mark.length > 32)) ||
    (value.notice !== undefined &&
      (typeof value.notice !== "string" || value.notice.length > 200))
  )
    return "Check the assessment fields (mark: 32 characters; private note: 200).";
}

export function unitProblem(input: UnitInput) {
  if (
    !input ||
    typeof input.title !== "string" ||
    !input.title.trim() ||
    input.title.length > 200 ||
    typeof input.version !== "string" ||
    (input.instruction !== undefined &&
      (typeof input.instruction !== "string" ||
        input.instruction.length > 100_000)) ||
    !["-1", "0"].includes(input.deadlineMode) ||
    typeof input.mandatory !== "boolean"
  )
    return "Check the exercise title and settings.";
  for (const value of [input.start, input.deadline, input.lateDeadline]) {
    if (typeof value !== "string")
      return "Use the date and time controls for the schedule.";
    if (!value) continue;
    const parts = value.match(
      /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?$/,
    );
    const values = parts?.slice(1).map((part) => Number(part || 0));
    if (!values) return "Use the date and time controls for the schedule.";
    const [year, month, day, hour, minute, second] = values;
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (
      year < 1970 ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    )
      return "Choose a valid schedule date and time.";
  }
  if (input.deadlineMode === "0" && !input.deadline)
    return "Choose a submission deadline.";
  if (input.deadlineMode === "0" && input.start && input.start > input.deadline)
    return "The start must be before the deadline.";
  if (
    input.deadlineMode === "0" &&
    input.lateDeadline &&
    input.lateDeadline < input.deadline
  )
    return "The late-submission deadline must follow the regular deadline.";
}
