import {
  limitSignIn,
  readSmallJson,
  RequestLimitError,
  withVerificationLimit,
} from "@/lib/ilias/request-limits";
import { publicHostname } from "@/lib/ilias/upstream-transport";
import { assertInstance } from "@/lib/ilias/config";
import {
  createSession,
  currentSession,
  deleteSession,
  requireSameOrigin,
  saveSession,
} from "@/lib/ilias/session";
import {
  cookieLogin,
  CookieLoginError,
  maxCookieInput,
} from "@/lib/ilias/cookie-login";
import { noStore } from "@/lib/api";

export const runtime = "nodejs";

function failure(error: unknown) {
  const known =
    error instanceof CookieLoginError || error instanceof RequestLimitError;
  return Response.json(
    {
      error: known
        ? error.message
        : "Could not connect with those cookies. Check the format and try again.",
    },
    { status: known ? error.status : 400, headers: noStore },
  );
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await limitSignIn(request, "start");
    const body = (await readSmallJson(request, 128 * 1024)) as {
      instance?: unknown;
      cookies?: unknown;
    };
    if (typeof body.instance !== "string" || typeof body.cookies !== "string")
      return Response.json(
        {
          error:
            "Enter the instance and a Cookie header, session value, or JSON export.",
        },
        { status: 400, headers: noStore },
      );
    const cookies = body.cookies;
    if (cookies.length > maxCookieInput)
      return Response.json(
        { error: "Cookie input is too large." },
        { status: 413, headers: noStore },
      );
    const target = assertInstance(body.instance);
    if (!publicHostname(new URL(target).hostname))
      return Response.json(
        {
          error:
            "Enter a public Internet HTTPS ILIAS hostname. Private networks and IP addresses are not supported.",
        },
        { status: 400, headers: noStore },
      );

    const previous = await currentSession();
    if (previous) await deleteSession(previous.id);
    const session = await createSession(target);
    try {
      const result = await withVerificationLimit(() =>
        cookieLogin(target, cookies),
      );
      session.jar = result.jar;
      session.userName = result.userName;
      session.status = "connected";
      await saveSession(session);
      return Response.json({ status: "connected" }, { headers: noStore });
    } catch (error) {
      await deleteSession(session.id);
      throw error;
    }
  } catch (error) {
    return failure(error);
  }
}
