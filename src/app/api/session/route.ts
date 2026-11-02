import { cookies } from "next/headers";
import {
  currentSession,
  deleteSession,
  SESSION_COOKIE,
} from "@/lib/ilias/session";
import { cancelLogin } from "@/lib/ilias/login";
import { noStore, sameOriginFailure } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const session = await currentSession();
  return Response.json(
    {
      status: session?.status || "disconnected",
      error: session?.error,
      method: session?.remotePairing ? "remote" : "local",
    },
    { headers: noStore },
  );
}

export async function DELETE(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const session = await currentSession();
  if (session) {
    await cancelLogin(session.id);
    await deleteSession(session.id);
  }
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ status: "disconnected" }, { headers: noStore });
}
