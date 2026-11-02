import { WorkspaceView } from "@/components/workspace/workspace-view";
import { getWorkspaceMetadata } from "@/lib/ilias/workspace";
export const metadata = { title: "Saved for later" };
export default async function Saved({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  return (
    <WorkspaceView
      data={await getWorkspaceMetadata((await searchParams).demo === "1")}
      view="saved"
    />
  );
}
