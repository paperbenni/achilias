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
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { instance, mode: requestedMode } = await request.json();
    const mode = requestedMode || serverLoginMode();
    if (mode !== "remote" && mode !== "local")
      return Response.json(
        { error: "Choose a valid sign-in method." },
        { status: 400 },
      );
    if (mode === "local" && serverLoginMode() === "remote")
      return Response.json(
        { error: "This server has no desktop sign-in. Choose On my computer." },
        { status: 400 },
      );
    if (typeof instance !== "string")
      return Response.json(
        { error: "Enter an ILIAS instance URL." },
        { status: 400 },
      );
    const target = assertInstance(instance);
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
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (
      previous?.status === "pending" &&
      previous.instance === target &&
      mode === "local" &&
      !previous.remotePairing
    )
      return Response.json({ status: "pending", mode: "local" });
    if (previous) {
      await cancelLogin(previous.id);
      await deleteSession(previous.id);
    }
    const session = await createSession(target);
    if (mode === "remote") {
      const remote = await prepareRemoteLogin(session);
      return Response.json(
        { status: "pending", mode: "remote", ...remote },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    beginLogin(session);
    return Response.json({ status: "pending", mode: "local" });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not connect." },
      { status: 400 },
    );
  }
}
