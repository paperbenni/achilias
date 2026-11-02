import {
  readSession,
  requireSameOrigin,
  saveSession,
  setSessionCookie,
} from "@/lib/ilias/session";
import { verifyPairing } from "@/lib/ilias/pairing";
export const runtime = "nodejs";
// Serialize claims within a process so a one-time token cannot be claimed concurrently.
let claiming = false;
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
  } catch {
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  }
  if (claiming)
    return Response.json({ error: "Please try again." }, { status: 409 });
  claiming = true;
  try {
    const { token } = await request.json();
    if (typeof token !== "string" || token.length > 120) throw new Error();
    const [id, secret] = token.split(".");
    const session = await readSession(id);
    if (
      !session?.pairing ||
      session.status !== "connected" ||
      !verifyPairing(
        secret || "",
        session.pairing.digest,
        session.pairing.expiresAt,
      )
    )
      throw new Error();
    delete session.pairing;
    await saveSession(session);
    await setSessionCookie(id);
    return Response.json({ status: "connected" });
  } catch {
    return Response.json(
      {
        error:
          "This connection link is invalid, already used, or expired. Run the connection command again.",
      },
      { status: 400 },
    );
  } finally {
    claiming = false;
  }
}
