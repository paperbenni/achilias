import { assertInstance } from "@/lib/ilias/config";
import {
  createSession,
  currentSession,
  deleteSession,
  requireSameOrigin,
} from "@/lib/ilias/session";
import { beginLogin, cancelLogin } from "@/lib/ilias/login";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { instance } = await request.json();
    if (typeof instance !== "string")
      return Response.json(
        { error: "Enter an ILIAS instance URL." },
        { status: 400 },
      );
    const target = assertInstance(instance);
    const previous = await currentSession();
    if (previous?.status === "pending")
      return Response.json({ status: "pending" });
    if (previous) {
      await cancelLogin(previous.id);
      await deleteSession(previous.id);
    }
    const session = await createSession(target);
    beginLogin(session);
    return Response.json({ status: "pending" });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not connect." },
      { status: 400 },
    );
  }
}
