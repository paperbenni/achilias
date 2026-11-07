import { WorkspaceView } from "@/components/workspace/workspace-view";
import { getWorkspaceMetadata } from "@/lib/ilias/workspace";
export const metadata = { title: "Features & connection" };
export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  return (
    <WorkspaceView
      data={await getWorkspaceMetadata((await searchParams).demo === "1")}
      view="settings"
    />
  );
}
