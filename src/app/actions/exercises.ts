"use server";
import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/ilias/workspace-context";
import {
  getLearnerFeedback,
  saveLearnerFeedback,
  saveAssessment,
  saveExerciseUnit,
} from "@/lib/ilias/exercise";
import type { AssessmentInput, UnitInput } from "@/lib/ilias/exercise-types";
async function connected(expectedConnection: string) {
  const { session, workspace } = await getWorkspaceContext();
  if (session?.status !== "connected")
    throw new Error("Reconnect your account to use tutor actions.");
  if (!expectedConnection || workspace.storageKey !== expectedConnection)
    throw new Error(
      "Your connection changed. Refresh this page before using tutor tools.",
    );
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
  connection: string,
) {
  try {
    const saved = await saveAssessment(
      await connected(connection),
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
      await connected(connection),
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
        await connected(connection),
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
      await connected(connection),
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
