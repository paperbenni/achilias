import { currentSession } from "@/lib/ilias/session";
import { fetchExercise } from "@/lib/ilias/exercise";
import { fetchUpstream, IliasError } from "@/lib/ilias/client";
import { validObjectId } from "@/lib/ilias/identifiers";
import { downloadHeaders, downloadResponse } from "@/lib/ilias/download";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ exerciseId: string; unitId: string; memberId: string }>;
  },
) {
  const headers = downloadHeaders();
  const { exerciseId, unitId, memberId } = await params;
  if (![exerciseId, unitId, memberId].every(validObjectId))
    return Response.json(
      { error: "Invalid submission." },
      { status: 400, headers },
    );
  const session = await currentSession();
  if (session?.status !== "connected")
    return Response.json(
      { error: "Connect your account to review submissions." },
      { status: 401, headers },
    );
  try {
    // Rediscover permission and URL; the browser supplies IDs, never an upstream URL.
    const exercise = await fetchExercise(session, exerciseId, unitId);
    const row = exercise.grading?.submissions.find(
      (row) => row.id === memberId,
    );
    if (!row?.downloadUrl)
      throw new IliasError(
        "ILIAS has not offered a download for this participant or team.",
        403,
      );
    const { response } = await fetchUpstream(session, row.downloadUrl, {
      file: true,
    });
    return await downloadResponse(
      response,
      `exercise-${exerciseId}-unit-${unitId}-submission-${memberId}.zip`,
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not download this submission.",
      },
      { status: error instanceof IliasError ? error.status : 502, headers },
    );
  }
}
