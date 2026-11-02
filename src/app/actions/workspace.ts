"use server";
import { currentSession } from "@/lib/ilias/session";
import { clearSearchFormCache } from "@/lib/ilias/search";
import { revalidatePath } from "next/cache";
import { clearWorkspacePages } from "@/lib/ilias/page-cache";

export async function refreshWorkspace() {
  // End upstream page reuse before the router refetches, then invalidate the
  // router's recent pages as well as the current view.
  const session = await currentSession();
  if (session) {
    await clearWorkspacePages(session.id);
    clearSearchFormCache(session.id);
  }
  revalidatePath("/", "layout");
}
