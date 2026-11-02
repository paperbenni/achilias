import { ForumPage } from "@/components/forums/forum-page";
export const metadata = { title: "Discussion forum" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ forumId: string }>;
  searchParams: Promise<{ demo?: string; page?: string }>;
}) {
  return (
    <ForumPage forumId={(await params).forumId} query={await searchParams} />
  );
}
