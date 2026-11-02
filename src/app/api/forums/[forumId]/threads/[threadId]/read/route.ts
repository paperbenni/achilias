import { currentSession, requireSameOrigin } from "@/lib/ilias/session";
import { fetchForum, validForumId } from "@/lib/ilias/forum";
import { fetchAuthenticatedHtml, IliasError } from "@/lib/ilias/client";
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
    // Rediscover the authorized action; never accept a target URL from the browser.
    const { thread } = await fetchForum(session, forumId, threadId);
    if (!thread?.markReadUrl)
      return Response.json(
        {
          error:
            "This discussion is already read, or ILIAS has not offered that action. Refresh to see its current status.",
        },
        { status: 409 },
      );
    await fetchAuthenticatedHtml(session, thread.markReadUrl);
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
