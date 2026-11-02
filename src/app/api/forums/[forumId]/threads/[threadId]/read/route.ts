import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/ilias/workspace-context";
import { validObjectId } from "@/lib/ilias/identifiers";
import { markForumThreadRead } from "@/lib/ilias/forum";
import { clearWorkspacePages } from "@/lib/ilias/page-cache";
import { errorResponse, noStore, sameOriginFailure } from "@/lib/api";

export const runtime = "nodejs";

/**
 * The single HTTP write path for thread read state, shared by the forum UI
 * and the headless smoke checks. Server actions are deliberately not used
 * here so authorization stays verifiable at the HTTP surface.
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
      { error: "Reconnect your account to update read status." },
      { status: 401, headers: noStore },
    );
  if (request.headers.get("x-achilias-connection") !== workspace.storageKey)
    return Response.json(
      {
        error: "Your connection changed. Refresh before updating read status.",
      },
      { status: 409, headers: noStore },
    );
  try {
    await markForumThreadRead(session, forumId, threadId);
    // Reused dashboard pages still carry the old unread counts.
    await clearWorkspacePages(session.id);
    // Keep every cached route's unread state in sync after a read.
    revalidatePath("/", "layout");
    return Response.json({ status: "read" }, { headers: noStore });
  } catch (e) {
    return errorResponse(e, {
      message: "Could not update read status.",
      status: 502,
    });
  }
}
