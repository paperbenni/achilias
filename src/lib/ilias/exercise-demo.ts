import type {
  ExerciseState,
  ExerciseUnit,
  Submission,
  UnitSettings,
} from "./exercise-types";
const base = "https://ilias.uni-freiburg.de/";
export const demoExerciseUnits: ExerciseUnit[] = [
  {
    id: "501",
    title: "Übung 01 — Algorithms",
    type: "File submission",
    start: "02 Nov 2026, 09:00",
    deadline: "09 Nov 2026, 18:00",
    mandatory: "Yes",
    instructions:
      "<p>Solve tasks 1–3. Explain your approach and upload a PDF.</p>",
    sourceUrl: base,
    editUrl: base,
  },
  {
    id: "502",
    title: "Übung 02 — Recursion",
    type: "Team file submission",
    start: "09 Nov 2026, 09:00",
    deadline: "16 Nov 2026, 18:00",
    mandatory: "Yes",
    instructions:
      "<p>Work with your team. Submit one PDF with all members listed.</p>",
    sourceUrl: base,
    editUrl: base,
  },
];
export function demoUnitSettings(id?: string): UnitSettings {
  const second = id === "502";
  return {
    title: id
      ? demoExerciseUnits.find((unit) => unit.id === id)?.title ||
        "New exercise unit"
      : "",
    instruction: id
      ? demoExerciseUnits.find((unit) => unit.id === id)?.instructions || ""
      : "",
    instructionText: id
      ? "Solve the tasks, explain your approach, and submit a PDF."
      : "",
    start: second ? "2026-11-09T09:00" : "2026-11-02T09:00",
    deadlineMode: "0",
    deadline: second ? "2026-11-16T18:00" : "2026-11-09T18:00",
    lateDeadline: "",
    mandatory: true,
    version: "demo",
    canEdit: true,
  };
}
export function demoSubmissions(team: boolean): Submission[] {
  return [
    {
      id: "701",
      name: team ? "Maya Chen · Jonas Becker" : "Maya Chen",
      login: team ? "Team 12" : "maya.chen",
      submitted: "08 Nov 2026, 14:32",
      late: false,
      status: "notgraded",
      mark: "",
      notice: "",
      feedback: "",
      downloadUrl: base,
      feedbackUrl: base,
      team,
      originalUrl: base,
      canAssess: true,
      version: "demo",
    },
    {
      id: "702",
      name: team ? "Lea Fischer · Samir Haddad" : "Jonas Becker",
      login: team ? "Team 15" : "jonas.becker",
      submitted: "09 Nov 2026, 19:12",
      late: true,
      status: "passed",
      mark: "8 / 10",
      notice: "Check explanation for task 3 next week.",
      feedback: "Good work. Make the loop invariant explicit next time.",
      downloadUrl: base,
      feedbackUrl: base,
      team,
      originalUrl: base,
      canAssess: true,
      version: "demo",
    },
    {
      id: "703",
      name: team ? "No team assigned" : "Lea Fischer",
      login: team ? "" : "lea.fischer",
      submitted: "",
      late: false,
      status: "notgraded",
      mark: "",
      notice: "",
      feedback: "",
      team,
      originalUrl: base,
      canAssess: !team,
      version: "demo",
    },
  ];
}
export function demoExercise(state: ExerciseState): ExerciseState {
  state.workspace.page.title = "Algorithms — Übungen";
  return {
    ...state,
    submissionsKnown: true,
    units: structuredClone(demoExerciseUnits),
    submissions: state.unitId
      ? demoSubmissions(state.unitId === "502").map((row) =>
          ["501", "502"].includes(state.unitId!)
            ? row
            : {
                ...row,
                submitted: "",
                late: false,
                status: "notgraded" as const,
                mark: "",
                notice: "",
                feedback: "",
                downloadUrl: undefined,
              },
        )
      : [],
    settings:
      state.unitId || state.creating ? demoUnitSettings(state.unitId) : null,
    tutor: true,
    canCreate: true,
    recognized: true,
  };
}
