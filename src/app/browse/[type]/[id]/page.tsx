import { notFound } from "next/navigation";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { getWorkspace } from "@/lib/ilias/workspace";
import { containers } from "@/lib/ilias/types";
export default async function Browse({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { type, id } = await params;
  const { demo } = await searchParams;
  if (!containers.has(type) || !/^[1-9]\d{0,11}$/.test(id)) notFound();
  return (
    <WorkspaceView
      data={await getWorkspace(demo === "1", type, id)}
      view="browse"
    />
  );
}
