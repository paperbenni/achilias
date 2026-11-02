import { WorkspaceView } from "@/components/workspace/workspace-view";
import { getWorkspace } from "@/lib/ilias/workspace";
export const metadata = { title: "Features & connection" };
export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  return (
    <WorkspaceView
      data={await getWorkspace((await searchParams).demo === "1")}
      view="settings"
    />
  );
}
