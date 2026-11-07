import { ExercisePage } from "@/components/exercises/exercise-page";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ exerciseId: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  return (
    <ExercisePage
      exerciseId={(await params).exerciseId}
      demo={(await searchParams).demo === "1"}
      creating
    />
  );
}
