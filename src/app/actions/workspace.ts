"use server";
import { revalidatePath } from "next/cache";

export async function refreshWorkspace() {
  // Invalidate the router's recent pages as well as the current view.
  revalidatePath("/", "layout");
}
