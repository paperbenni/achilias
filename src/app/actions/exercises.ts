"use server";
import { revalidatePath } from "next/cache";
import { requireWorkspaceConnection } from "@/lib/ilias/workspace-context";
import {
  getLearnerFeedback,
  saveLearnerFeedback,
  saveAssessment,
  saveExerciseUnit,
} from "@/lib/ilias/exercise";
import type { AssessmentInput, UnitInput } from "@/lib/ilias/exercise-types";
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The tutor action could not finish. Check ILIAS before retrying.";
export async function assessSubmission(
  exerciseId: string,
  unitId: string,
  memberId: string,
  input: AssessmentInput,
  connection: string,
) {
  try {
    const saved = await saveAssessment(
      await requireWorkspaceConnection(connection),
      exerciseId,
      unitId,
      memberId,
      input,
    );
    revalidatePath("/", "layout");
    return { saved };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
export async function updateExerciseUnit(
  exerciseId: string,
  unitId: string | undefined,
  input: UnitInput,
  connection: string,
) {
  try {
    const saved = await saveExerciseUnit(
      await requireWorkspaceConnection(connection),
      exerciseId,
      unitId,
      input,
    );
    revalidatePath("/", "layout");
    return { saved };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
export async function loadFeedback(
  exerciseId: string,
  unitId: string,
  memberId: string,
  connection: string,
) {
  try {
    return {
      editor: await getLearnerFeedback(
        await requireWorkspaceConnection(connection),
        exerciseId,
        unitId,
        memberId,
      ),
    };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
export async function sendFeedback(
  exerciseId: string,
  unitId: string,
  memberId: string,
  value: string,
  version: string,
  connection: string,
) {
  try {
    const saved = await saveLearnerFeedback(
      await requireWorkspaceConnection(connection),
      exerciseId,
      unitId,
      memberId,
      value,
      version,
    );
    revalidatePath("/", "layout");
    return { saved };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
