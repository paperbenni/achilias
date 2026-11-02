import { notFound } from "next/navigation";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { validObjectId } from "@/lib/ilias/identifiers";
import { getExerciseState } from "@/lib/ilias/exercise";
import { ExerciseView } from "./exercise-view";
export async function ExercisePage({
  exerciseId,
  unitId,
  demo,
  creating = false,
}: {
  exerciseId: string;
  unitId?: string;
  demo: boolean;
  creating?: boolean;
}) {
  if (
    !validObjectId(exerciseId) ||
    (unitId && !validObjectId(unitId)) ||
    (demo && exerciseId !== "401")
  )
    notFound();
  const state = await getExerciseState(exerciseId, unitId, demo, creating);
  return (
    <WorkspaceView data={state.workspace} view="exercise">
      <ExerciseView state={state} />
    </WorkspaceView>
  );
}
