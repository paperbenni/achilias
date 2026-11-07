import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getWorkspaceMetadata } from "@/lib/ilias/workspace";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The layout cannot read searchParams, so both account variants are resolved
  // here and the client shell picks one for the current URL.
  const [live, demo] = await Promise.all([
    getWorkspaceMetadata(false),
    getWorkspaceMetadata(true),
  ]);
  return (
    <WorkspaceShell live={live} demo={demo}>
      {children}
    </WorkspaceShell>
  );
}
