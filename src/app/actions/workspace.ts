"use server";
import { revalidatePath } from "next/cache";
import { clearWorkspacePages } from "@/lib/ilias/page-cache";

export async function refreshWorkspace() {
  // End upstream page reuse before the router refetches, then invalidate the
  // router's recent pages as well as the current view.
  clearWorkspacePages();
  revalidatePath("/", "layout");
}
