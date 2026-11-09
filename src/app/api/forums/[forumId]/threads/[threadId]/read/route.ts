import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/ilias/workspace-context";
import { validObjectId } from "@/lib/ilias/identifiers";
import { markForumPostRead, markForumThreadRead } from "@/lib/ilias/forum";
import { clearWorkspacePages } from "@/lib/ilias/page-cache";
import { errorResponse, noStore, sameOriginFailure } from "@/lib/api";

export const runtime = "nodejs";

/**
 * The single HTTP write path for forum read state, shared by the forum UI
 * and the headless smoke checks. Without a postId it marks the whole thread
 * read; with one it marks a single post read. Server actions are deliberately
 * not used here so authorization stays verifiable at the HTTP surface.
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
  let postId: string | undefined;
  let page = 0;
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      postId?: unknown;
      page?: unknown;
    } | null;
    if (!body)
      return Response.json(
        { error: "Invalid read request." },
        { status: 400, headers: noStore },
      );
    if (body.postId !== undefined) {
      if (typeof body.postId !== "string" || !validObjectId(body.postId))
        return Response.json(
          { error: "Invalid post." },
          { status: 400, headers: noStore },
        );
      postId = body.postId;
    }
    if (body.page !== undefined) {
      if (
        typeof body.page !== "number" ||
        !Number.isInteger(body.page) ||
        body.page < 0 ||
        body.page > 99999
      )
        return Response.json(
          { error: "Invalid post page." },
          { status: 400, headers: noStore },
        );
      page = body.page;
    }
  }
  try {
    if (postId)
      await markForumPostRead(session, forumId, threadId, postId, page);
    else await markForumThreadRead(session, forumId, threadId);
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
