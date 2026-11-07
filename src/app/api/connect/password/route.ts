import {
  limitSignIn,
  readSmallJson,
  RequestLimitError,
} from "@/lib/ilias/request-limits";
import { allowedInstances } from "@/lib/ilias/config";
import { requireSameOrigin } from "@/lib/ilias/session";
import { passwordLoginEnabled } from "@/lib/ilias/login-flags";
import {
  passwordLogin,
  PasswordLoginError,
} from "@/lib/ilias/password-login";
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
    if (!passwordLoginEnabled())
      return Response.json(
        { error: "Password sign-in is disabled on this server." },
        { status: 403, headers: noStore },
      );
    const body = (await readSmallJson(request)) as {
      instance?: unknown;
      username?: unknown;
      password?: unknown;
    };
    if (
      typeof body.instance !== "string" ||
      typeof body.username !== "string" ||
      typeof body.password !== "string"
    )
      return Response.json(
        { error: "Enter the instance, username, and password." },
        { status: 400, headers: noStore },
      );
    const username = body.username.trim();
    if (!username || username.length > 256)
      return Response.json(
        { error: "Enter a valid username." },
        { status: 400, headers: noStore },
      );
    if (!body.password || body.password.length > 1024)
      return Response.json(
        { error: "Enter a valid password." },
        { status: 400, headers: noStore },
      );
    const password = body.password;
    const target = assertPublicInstance(body.instance);
    // Do not turn this endpoint into an open credential proxy.
    if (!allowedInstances().includes(target))
      return Response.json(
        {
          error:
            "Password sign-in is only allowed for configured ILIAS instances.",
        },
        { status: 403, headers: noStore },
      );

    return connectWithVerifiedJar(target, () =>
      passwordLogin(target, username, password),
    );
  } catch (error) {
    return connectFailure(
      error,
      (e): e is Error & { status: number } =>
        e instanceof PasswordLoginError ||
        e instanceof RequestLimitError ||
        e instanceof ConnectRequestError,
      "Could not sign in with the university account.",
    );
  }
}
