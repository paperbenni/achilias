import { cookies } from "next/headers";
import {
  currentSession,
  deleteSession,
  requireSameOrigin,
  SESSION_COOKIE,
} from "@/lib/ilias/session";
import { cancelLogin } from "@/lib/ilias/login";
export const runtime = "nodejs";
export async function GET() {
  const session = await currentSession();
  return Response.json(
    {
      status: session?.status || "disconnected",
      error: session?.error,
      method: session?.remotePairing ? "remote" : "local",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
  } catch {
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  }
  const session = await currentSession();
  if (session) {
    await cancelLogin(session.id);
    await deleteSession(session.id);
  }
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ status: "disconnected" });
}
