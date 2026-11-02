"use server";
import { revalidatePath } from "next/cache";
import { currentSession } from "@/lib/ilias/session";
import {
  getLearnerFeedback,
  saveLearnerFeedback,
  saveAssessment,
  saveExerciseUnit,
} from "@/lib/ilias/exercise";
import type { AssessmentInput, UnitInput } from "@/lib/ilias/exercise-types";
async function connected() {
  const session = await currentSession();
  if (session?.status !== "connected")
    throw new Error("Reconnect your account to use tutor actions.");
  return session;
}
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The tutor action could not finish. Check ILIAS before retrying.";
export async function assessSubmission(
  exerciseId: string,
  unitId: string,
  memberId: string,
  input: AssessmentInput,
) {
  try {
    const saved = await saveAssessment(
      await connected(),
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
) {
  try {
    const saved = await saveExerciseUnit(
      await connected(),
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
) {
  try {
    return {
      editor: await getLearnerFeedback(
        await connected(),
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
) {
  try {
    const saved = await saveLearnerFeedback(
      await connected(),
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
