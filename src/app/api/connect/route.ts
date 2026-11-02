import {
  limitSignIn,
  readSmallJson,
  RequestLimitError,
} from "@/lib/ilias/request-limits";
import { publicHostname } from "@/lib/ilias/upstream-transport";
import { assertInstance } from "@/lib/ilias/config";
import {
  createSession,
  currentSession,
  deleteSession,
  requireSameOrigin,
} from "@/lib/ilias/session";
import { prepareRemoteLogin } from "@/lib/ilias/remote-login";
import { passwordLoginEnabled } from "@/lib/ilias/login-flags";
import { noStore } from "@/lib/api";
export const runtime = "nodejs";
export async function GET() {
  return Response.json(
    {
      mode: "remote",
      passwordLoginAvailable: passwordLoginEnabled(),
    },
    { headers: noStore },
  );
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await limitSignIn(request, "start");
    const { instance } = (await readSmallJson(request)) as {
      instance?: unknown;
    };
    if (typeof instance !== "string")
      return Response.json(
        { error: "Enter an ILIAS instance URL." },
        { status: 400, headers: noStore },
      );
    const target = assertInstance(instance);
    if (!publicHostname(new URL(target).hostname))
      return Response.json(
        {
          error:
            "Enter a public Internet HTTPS ILIAS hostname. Private networks and IP addresses are not supported.",
        },
        { status: 400, headers: noStore },
      );
    const previous = await currentSession();
    if (
      previous?.status === "pending" &&
      previous.instance === target &&
      previous.remotePairing
    ) {
      const remote = await prepareRemoteLogin(previous);
      return Response.json(
        { status: "pending", mode: "remote", ...remote },
        { headers: noStore },
      );
    }
    if (previous) await deleteSession(previous.id);
    const session = await createSession(target);
    const remote = await prepareRemoteLogin(session);
    return Response.json(
      { status: "pending", mode: "remote", ...remote },
      { headers: noStore },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not connect." },
      {
        status: e instanceof RequestLimitError ? 429 : 400,
        headers: {
          ...noStore,
          ...(e instanceof RequestLimitError ? { "Retry-After": "600" } : {}),
        },
      },
    );
  }
}
