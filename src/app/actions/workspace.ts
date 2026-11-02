"use server";
import { revalidatePath } from "next/cache";
import { currentSession } from "@/lib/ilias/session";
import { markForumThreadRead } from "@/lib/ilias/forum";
export async function refreshWorkspace() {
  // Invalidate the router's recent pages as well as the current view.
  revalidatePath("/", "layout");
}
export async function markThreadRead(forumId: string, threadId: string) {
  const session = await currentSession();
  if (session?.status !== "connected")
    return { error: "Reconnect your account to update read status." };
  try {
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
