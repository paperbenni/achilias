import {
  limitSignIn,
  readSmallJson,
  RequestLimitError,
} from "@/lib/ilias/request-limits";
import {
  createSession,
  currentSession,
  deleteSession,
  requireSameOrigin,
} from "@/lib/ilias/session";
import {
  prepareRemoteLogin,
  RemoteLoginError,
} from "@/lib/ilias/remote-login";
import { noStore } from "@/lib/api";
import {
  assertPublicInstance,
  ConnectRequestError,
  connectFailure,
} from "./helpers";

export const runtime = "nodejs";

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
    const target = assertPublicInstance(instance);
    const previous = await currentSession();
    if (
      previous?.status === "pending" &&
      previous.instance === target &&
      previous.remotePairing
    ) {
      const remote = await prepareRemoteLogin(previous);
      return Response.json(
        { status: "pending", ...remote },
        { headers: noStore },
      );
    }
    if (previous) await deleteSession(previous.id);
    const session = await createSession(target);
    const remote = await prepareRemoteLogin(session);
    return Response.json(
      { status: "pending", ...remote },
      { headers: noStore },
    );
  } catch (error) {
    return connectFailure(
      error,
      (e): e is Error & { status: number } =>
        e instanceof RemoteLoginError ||
        e instanceof RequestLimitError ||
        e instanceof ConnectRequestError,
      "Could not connect.",
    );
  }
}
