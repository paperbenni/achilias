import { z } from "zod";

export const assessmentStatusSchema = z.enum(["notgraded", "passed", "failed"]);
export const assessmentInputSchema = z.object({
  status: assessmentStatusSchema,
  mark: z.string().max(32).optional(),
  notice: z.string().max(200).optional(),
  version: z.string(),
});
const scheduleMessage = "Choose a valid schedule date and time.";
// These are wall-clock values in the ILIAS profile timezone, not UTC instants.
const localDateTime = z
  .union([
    z.iso.datetime({ local: true, precision: -1 }),
    z.iso.datetime({ local: true, precision: 0 }),
  ])
  .refine(
    (value) => !value.endsWith("Z") && value.slice(0, 4) >= "1970",
    scheduleMessage,
  );
const schedule = z.union([z.literal(""), localDateTime], {
  error: scheduleMessage,
});
export const unitInputSchema = z
  .object({
    title: z
      .string()
      .min(1)
      .max(200)
      .refine((value) => !!value.trim()),
    instruction: z.string().max(100_000).optional(),
    start: schedule,
    deadlineMode: z.enum(["-1", "0"]),
    deadline: schedule,
    lateDeadline: schedule,
    mandatory: z.boolean(),
    version: z.string(),
  })
  .superRefine((input, context) => {
    if (input.deadlineMode !== "0") return;
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });
    if (!input.deadline) issue("deadline", "Choose a submission deadline.");
    // Normalize optional seconds so equal minute/second values compare equally.
    const comparable = (value: string) =>
      value.length === 16 ? value + ":00" : value;
    if (
      input.start &&
      input.deadline &&
      comparable(input.start) > comparable(input.deadline)
    )
      issue("start", "The start must be before the deadline.");
    if (
      input.lateDeadline &&
      input.deadline &&
      comparable(input.lateDeadline) < comparable(input.deadline)
    )
      issue(
        "lateDeadline",
        "The late-submission deadline must follow the regular deadline.",
      );
  });
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;
export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
export type UnitInput = z.infer<typeof unitInputSchema>;

export function assessmentProblem(value: unknown) {
  if (!assessmentInputSchema.safeParse(value).success)
    return "Check the assessment fields (mark: 32 characters; private note: 200).";
}
export function unitProblem(value: unknown) {
  const result = unitInputSchema.safeParse(value);
  if (result.success) return;
  const issue = result.error.issues[0];
  return ["start", "deadline", "lateDeadline"].includes(String(issue.path[0]))
    ? issue.message
    : "Check the exercise title and settings.";
}
