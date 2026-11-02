import {
  limitSignIn,
  RequestLimitError,
  withVerificationLimit,
} from "@/lib/ilias/request-limits";
import {
  completeRemoteLogin,
  readRemotePayload,
  remoteSession,
  RemoteLoginError,
} from "@/lib/ilias/remote-login";
import { requireSameOrigin } from "@/lib/ilias/session";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
function codeFrom(request: Request) {
  limitSignIn(request, "transfer");
  // CLI transfers use a bearer code, never a browser's session cookie.
  if (request.headers.has("origin")) {
    try {
      requireSameOrigin(request);
    } catch {
      throw new RemoteLoginError("Request origin is not allowed.", 403);
    }
  }
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer "))
    throw new RemoteLoginError("A connection code is required.", 401);
  return auth.slice(7);
}
function failure(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof RemoteLoginError || error instanceof RequestLimitError
          ? error.message
          : "Could not accept the session export. Check the cookie format and try again.",
    },
    {
      status:
        error instanceof RemoteLoginError || error instanceof RequestLimitError
          ? error.status
          : 400,
      headers,
    },
  );
}
export async function GET(request: Request) {
  try {
    const session = await remoteSession(codeFrom(request));
    return Response.json(
      {
        instance: session.instance,
        expiresAt: session.remotePairing!.expiresAt,
      },
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const code = codeFrom(request);
    await remoteSession(code);
    const data = await readRemotePayload(request);
    await withVerificationLimit(() => completeRemoteLogin(code, data));
    return Response.json({ status: "connected" }, { headers });
  } catch (e) {
    return failure(e);
  }
}
