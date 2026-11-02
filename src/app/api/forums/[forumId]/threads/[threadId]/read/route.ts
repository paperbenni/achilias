import { currentSession, requireSameOrigin } from "@/lib/ilias/session";
import { markForumThreadRead, validForumId } from "@/lib/ilias/forum";
import { IliasError } from "@/lib/ilias/client";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ forumId: string; threadId: string }> },
) {
  try {
    requireSameOrigin(request);
  } catch {
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  }
  const { forumId, threadId } = await params;
  if (!validForumId(forumId) || !validForumId(threadId))
    return Response.json({ error: "Invalid discussion." }, { status: 400 });
  const session = await currentSession();
  if (session?.status !== "connected")
    return Response.json(
      { error: "Reconnect your account to update read status." },
      { status: 401 },
    );
  try {
    await markForumThreadRead(session, forumId, threadId);
    return Response.json(
      { status: "read" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Could not update read status.",
      },
      { status: e instanceof IliasError ? e.status : 502 },
    );
  }
}
