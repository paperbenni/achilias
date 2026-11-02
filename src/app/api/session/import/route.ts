import {
  limitSignIn,
  readSmallJson,
  RequestLimitError,
} from "@/lib/ilias/request-limits";
import {
  claimSession,
  invalidClaimMessage,
  setSessionCookie,
} from "@/lib/ilias/session";
import { noStore, sameOriginFailure } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  try {
    await limitSignIn(request, "claim");
    const { token } = (await readSmallJson(request)) as { token?: unknown };
    const id = await claimSession(token);
    await setSessionCookie(id);
    return Response.json({ status: "connected" }, { headers: noStore });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RequestLimitError
            ? error.message
            : invalidClaimMessage,
      },
      {
        status: error instanceof RequestLimitError ? 429 : 400,
        headers: noStore,
      },
    );
  }
}
