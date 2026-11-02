import { WorkspaceView } from "@/components/workspace/workspace-view";
import { getWorkspace } from "@/lib/ilias/workspace";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; section?: string }>;
}) {
  const params = await searchParams;
  return (
    <WorkspaceView
      data={await getWorkspace(params.demo === "1")}
      section={params.section}
    />
  );
}
