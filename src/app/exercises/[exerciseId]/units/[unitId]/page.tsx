import { ExercisePage } from "@/components/exercises/exercise-page";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ exerciseId: string; unitId: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { exerciseId, unitId } = await params;
  return (
    <ExercisePage
      exerciseId={exerciseId}
      unitId={unitId}
      demo={(await searchParams).demo === "1"}
    />
  );
}
