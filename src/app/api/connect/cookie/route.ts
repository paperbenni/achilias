import {
  limitSignIn,
  readSmallJson,
  RequestLimitError,
} from "@/lib/ilias/request-limits";
import { requireSameOrigin } from "@/lib/ilias/session";
import {
  cookieLogin,
  CookieLoginError,
  maxCookieInput,
} from "@/lib/ilias/cookie-login";
import { noStore } from "@/lib/api";
import {
  assertPublicInstance,
  ConnectRequestError,
  connectFailure,
  connectWithVerifiedJar,
} from "../helpers";

export const runtime = "nodejs";

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
    const target = assertPublicInstance(body.instance);

    return connectWithVerifiedJar(target, () => cookieLogin(target, cookies));
  } catch (error) {
    return connectFailure(
      error,
      (e): e is Error & { status: number } =>
        e instanceof CookieLoginError ||
        e instanceof RequestLimitError ||
        e instanceof ConnectRequestError,
      "Could not connect with those cookies. Check the format and try again.",
    );
  }
}
