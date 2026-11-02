import {
  claimSession,
  invalidClaimMessage,
  requireSameOrigin,
  setSessionCookie,
} from "@/lib/ilias/session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
  } catch {
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  }
  try {
    const { token } = await request.json();
    const id = await claimSession(token);
    await setSessionCookie(id);
    return Response.json({ status: "connected" });
  } catch {
    return Response.json({ error: invalidClaimMessage }, { status: 400 });
  }
}
