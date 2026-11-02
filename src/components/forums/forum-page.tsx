import { validObjectId } from "@/lib/ilias/identifiers";
import { notFound } from "next/navigation";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { ForumView } from "./forum-view";
import { forumOrder, forumPageNumber, getForumState } from "@/lib/ilias/forum";
export async function ForumPage({
  forumId,
  threadId,
  query,
}: {
  forumId: string;
  threadId?: string;
  query: { demo?: string; page?: string; order?: string };
}) {
  if (!validObjectId(forumId) || (threadId && !validObjectId(threadId)))
    notFound();
  let page;
  let order;
  try {
    page = forumPageNumber(query.page);
    order = forumOrder(query.order);
  } catch {
    notFound();
  }
  const demo = query.demo === "1";
  if (
    demo &&
    (forumId !== "402" ||
      page !== 0 ||
      (threadId && !["901", "902", "903", "904", "905"].includes(threadId)))
  )
    notFound();
  const state = await getForumState(forumId, threadId, demo, page, order);
  return (
    <WorkspaceView data={state.workspace} view="forum">
      <ForumView
        key={`${forumId}:${threadId || "overview"}:${page}:${order}`}
        state={state}
      />
    </WorkspaceView>
  );
}
