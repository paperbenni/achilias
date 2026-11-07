import { getWorkspaceContext } from "@/lib/ilias/workspace-context";
import { validObjectId } from "@/lib/ilias/identifiers";
import { getForumThreadPreview } from "@/lib/ilias/forum";
import { errorResponse, noStore, sameOriginFailure } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Read-only preview of a discussion's opening post. A POST keeps the
 * same-origin guard and the explicit connection check used by the other
 * forum action, and prevents browsers or proxies from speculatively fetching
 * an upstream thread page.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ forumId: string; threadId: string }> },
) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const { forumId, threadId } = await params;
  if (!validObjectId(forumId) || !validObjectId(threadId))
    return Response.json(
      { error: "Invalid discussion." },
      { status: 400, headers: noStore },
    );
  const { session, workspace } = await getWorkspaceContext();
  if (session?.status !== "connected")
    return Response.json(
      { error: "Reconnect your account to load discussion previews." },
      { status: 401, headers: noStore },
    );
  if (request.headers.get("x-achilias-connection") !== workspace.storageKey)
    return Response.json(
      {
        error: "Your connection changed. Refresh before loading previews.",
      },
      { status: 409, headers: noStore },
    );
  try {
    const preview = await getForumThreadPreview(session, forumId, threadId);
    return Response.json({ preview }, { headers: noStore });
  } catch (e) {
    return errorResponse(e, {
      message: "Could not load this discussion preview.",
      status: 502,
    });
  }
}
