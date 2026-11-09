import { validObjectId } from "@/lib/ilias/identifiers";
import { notFound } from "next/navigation";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { getWorkspace } from "@/lib/ilias/workspace";
import { isContainerType } from "@/lib/ilias/items";
export default async function Browse({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { type, id } = await params;
  const { demo } = await searchParams;
  if (!isContainerType(type) || !validObjectId(id)) notFound();
  return (
    <WorkspaceView
      data={await getWorkspace(demo === "1", type, id)}
      view="browse"
      objectType={type}
      objectId={id}
    />
  );
}
