import {
  limitSignIn,
  readSmallJson,
  RequestLimitError,
} from "@/lib/ilias/request-limits";
import {
  claimSession,
  invalidClaimMessage,
  requireSameOrigin,
  setSessionCookie,
} from "@/lib/ilias/session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
  } catch {
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  }
  try {
    limitSignIn(request, "claim");
    const { token } = (await readSmallJson(request)) as { token?: unknown };
    const id = await claimSession(token);
    await setSessionCookie(id);
    return Response.json({ status: "connected" });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RequestLimitError
            ? error.message
            : invalidClaimMessage,
      },
      { status: error instanceof RequestLimitError ? 429 : 400 },
    );
  }
}
