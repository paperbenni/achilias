import {
  limitSignIn,
  readSmallJson,
  RequestLimitError,
  withVerificationLimit,
} from "@/lib/ilias/request-limits";
import { publicHostname } from "@/lib/ilias/upstream-transport";
import { allowedInstances, assertInstance } from "@/lib/ilias/config";
import {
  createSession,
  currentSession,
  deleteSession,
  requireSameOrigin,
  saveSession,
} from "@/lib/ilias/session";
import { passwordLoginEnabled } from "@/lib/ilias/login-flags";
import {
  passwordLogin,
  PasswordLoginError,
} from "@/lib/ilias/password-login";
import { noStore } from "@/lib/api";

export const runtime = "nodejs";

function failure(error: unknown) {
  const known =
    error instanceof PasswordLoginError || error instanceof RequestLimitError;
  return Response.json(
    {
      error: known
        ? error.message
        : "Could not sign in with the university account.",
    },
    {
      status: known ? error.status : 400,
      headers: noStore,
    },
  );
}

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
    const target = assertInstance(body.instance);
    // Do not turn this endpoint into an open credential proxy.
    if (!allowedInstances().includes(target))
      return Response.json(
        {
          error:
            "Password sign-in is only allowed for configured ILIAS instances.",
        },
        { status: 403, headers: noStore },
      );
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
        passwordLogin(target, username, password),
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
