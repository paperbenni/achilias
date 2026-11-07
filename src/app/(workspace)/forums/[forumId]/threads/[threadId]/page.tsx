import { ForumPage } from "@/components/forums/forum-page";
export const metadata = { title: "Discussion" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ forumId: string; threadId: string }>;
  searchParams: Promise<{ demo?: string; page?: string; order?: string }>;
}) {
  const { forumId, threadId } = await params;
  return (
    <ForumPage
      forumId={forumId}
      threadId={threadId}
      query={await searchParams}
    />
  );
}
