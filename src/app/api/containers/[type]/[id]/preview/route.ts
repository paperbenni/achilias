import { errorResponse, noStore, sameOriginFailure } from "@/lib/api";
import { getContainerPreview } from "@/lib/ilias/container-preview";
import { isPreviewableContainer } from "@/lib/ilias/items";
import { validObjectId } from "@/lib/ilias/identifiers";
import { getWorkspaceContext } from "@/lib/ilias/workspace-context";

export const runtime = "nodejs";

/**
 * Read-only preview of a category's or folder's first listing page. A POST
 * keeps the same-origin guard and explicit connection check used by the other
 * on-demand reads, so browsers and proxies do not speculatively open containers.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const { type, id } = await params;
  if (!isPreviewableContainer(type) || !validObjectId(id))
    return Response.json(
      { error: "Invalid category or folder." },
      { status: 400, headers: noStore },
    );
  const { session, workspace } = await getWorkspaceContext();
  if (session?.status !== "connected")
    return Response.json(
      { error: "Reconnect your account to preview this container." },
      { status: 401, headers: noStore },
    );
  if (request.headers.get("x-achilias-connection") !== workspace.storageKey)
    return Response.json(
      {
        error: "Your connection changed. Refresh before previewing containers.",
      },
      { status: 409, headers: noStore },
    );
  try {
    const preview = await getContainerPreview(session, type, id);
    return Response.json({ preview }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, {
      message: "Could not preview this category or folder.",
      status: 502,
    });
  }
}
