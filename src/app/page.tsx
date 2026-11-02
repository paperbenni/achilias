import { WorkspaceView } from "@/components/workspace/workspace-view";
import { getWorkspace } from "@/lib/ilias/workspace";
import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; section?: string }>;
}) {
  const params = await searchParams;
  // The old section anchor became a real destination.
  if (params.section === "courses")
    redirect(`/courses${params.demo === "1" ? "?demo=1" : ""}`);
  return <WorkspaceView data={await getWorkspace(params.demo === "1")} />;
}
