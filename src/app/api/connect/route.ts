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
import { serverLoginMode } from "@/lib/ilias/login";
import { beginLogin, cancelLogin } from "@/lib/ilias/login";
import { noStore } from "@/lib/api";
export const runtime = "nodejs";
export async function GET() {
  const session = await currentSession();
  return Response.json(
    {
      mode:
        session?.status === "pending"
          ? session.remotePairing
            ? "remote"
            : "local"
          : serverLoginMode(),
      localBrowserAvailable: serverLoginMode() === "local",
    },
    { headers: noStore },
  );
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await limitSignIn(request, "start");
    const { instance, mode: requestedMode } = (await readSmallJson(
      request,
    )) as { instance?: unknown; mode?: string };
    const mode = requestedMode || serverLoginMode();
    if (mode !== "remote" && mode !== "local")
      return Response.json(
        { error: "Choose a valid sign-in method." },
        { status: 400, headers: noStore },
      );
    if (mode === "local" && serverLoginMode() === "remote")
      return Response.json(
        { error: "This server has no desktop sign-in. Choose On my computer." },
        { status: 400, headers: noStore },
      );
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
      mode === "remote" &&
      previous.remotePairing
    ) {
      const remote = await prepareRemoteLogin(previous);
      return Response.json(
        { status: "pending", mode: "remote", ...remote },
        { headers: noStore },
      );
    }
    if (
      previous?.status === "pending" &&
      previous.instance === target &&
      mode === "local" &&
      !previous.remotePairing
    )
      return Response.json(
        { status: "pending", mode: "local" },
        { headers: noStore },
      );
    if (previous) {
      await cancelLogin(previous.id);
      await deleteSession(previous.id);
    }
    const session = await createSession(target);
    if (mode === "remote") {
      const remote = await prepareRemoteLogin(session);
      return Response.json(
        { status: "pending", mode: "remote", ...remote },
        { headers: noStore },
      );
    }
    beginLogin(session);
    return Response.json(
      { status: "pending", mode: "local" },
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
