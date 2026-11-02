"use server";
import { revalidatePath } from "next/cache";
import { requireWorkspaceConnection } from "@/lib/ilias/workspace-context";
import { markForumThreadRead } from "@/lib/ilias/forum";
export async function refreshWorkspace() {
  // Invalidate the router's recent pages as well as the current view.
  revalidatePath("/", "layout");
}
export async function markThreadRead(
  forumId: string,
  threadId: string,
  connection: string,
) {
  try {
    const session = await requireWorkspaceConnection(connection);
    await markForumThreadRead(session, forumId, threadId);
    revalidatePath("/", "layout");
    return { status: "read" };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update read status.",
    };
  }
}
