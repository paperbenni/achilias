import { afterEach, expect, mock, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  parseForumOverview,
  parseForumThread,
  sanitizeForumBody,
} from "../src/lib/ilias/forum-parser";
import { forumViewUrl, fetchForum } from "../src/lib/ilias/forum";
import { FREIBURG } from "../src/lib/ilias/config";
const url =
  FREIBURG +
  "ilias.php?ref_id=402&cmdClass=ilobjforumgui&cmdNode=a:b&cmd=showThreads";
const fixture = (name: string) =>
  readFile(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8");
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
test("ILIAS 10 standard-item forum list preserves localized counts, pinning, and closed state", async () => {
  const forum = parseForumOverview(await fixture("forum"), url, "402");
  expect(forum.title).toBe("Questions & discussion");
  expect(forum.topics).toHaveLength(2);
  expect(forum.topics[0]).toMatchObject({
    id: "901",
    posts: 5,
    unread: 2,
    pinned: true,
    author: "Moderator",
  });
  expect(forum.topics[1]).toMatchObject({
    id: "902",
    posts: 1,
    unread: 0,
    closed: true,
  });
  expect(forum.pages).toEqual([{ page: 0 }, { page: 1 }]);
  expect(forum.createUrl).toContain("cmd=createThread");
});
test("legacy tables retain thread metadata and unread counts", () => {
  const html =
    '<table><tr class="tblstickyrow1"><td></td><td><a href="ilias.php?ref_id=402&thr_pk=901&cmd=viewThread">A topic</a></td><td>Alex</td><td>6<br><span>Unread: 3</span></td><td>10</td><td>Today</td></tr></table>';
  expect(parseForumOverview(html, url, "402").topics[0]).toMatchObject({
    posts: 6,
    unread: 3,
    pinned: true,
    lastActivity: "Today",
  });
});
test("thread reader preserves reply hierarchy, author metadata, unread state and available actions", async () => {
  const thread = parseForumThread(
    await fixture("forum-thread"),
    url.replace("showThreads", "viewThread") + "&thr_pk=901",
    "901",
  );
  expect(thread.title).toBe("Binary search");
  expect(thread.posts).toHaveLength(4);
  expect(thread.posts.map((p) => p.parentId)).toEqual([
    undefined,
    "1001",
    "1002",
    "1001",
  ]);
  expect(thread.posts[1]).toMatchObject({
    unread: true,
    moderator: true,
    date: "02. Nov 2026, 10:00",
  });
  expect(thread.posts[0].author).toBe("Maya");
  expect(thread.posts[0].date).toBe("02. Nov 2026, 09:00");
  expect(thread.posts[0].replyUrl).toContain("action=showreply");
  expect(thread.posts[1].replyUrl).toBeUndefined();
  expect(thread.posts[0].attachments[0].title).toBe("notes.pdf");
  expect(thread.posts[3].status).toBe("Awaiting approval");
  expect(thread.markReadUrl).toContain("mark_read=1");
  expect(thread.replyUrl).toContain("createTopLevelPost");
  expect(thread.pages).toEqual([{ page: 0 }, { page: 1 }]);
  expect(JSON.stringify(thread)).not.toContain("PRIVATE DRAFT");
});
test("forum bodies keep useful formatting while blocking scripts, trackers, event handlers and unsafe URLs", async () => {
  const thread = parseForumThread(await fixture("forum-thread"), url, "901");
  const body = thread.posts[0].body;
  expect(body).toContain("<strong>sorted</strong>");
  expect(body).toContain("<pre><code>find(2)</code></pre>");
  expect(body).toContain(
    "https://ilias.uni-freiburg.de/goto.php?target=file_42",
  );
  expect(body).not.toMatch(/script|onerror|<img|<iframe|javascript:/i);
  expect(thread.posts[0].hasEmbeddedContent).toBe(true);
  expect(
    sanitizeForumBody(
      '<a href="java\nscript:alert(1)">x</a><svg><script>x</script></svg>',
      url,
    ),
  ).not.toMatch(/script|svg/i);
});
test("chronological posts do not invent parent relationships", async () => {
  const html = (await fixture("forum-thread")).replace(
    "sort_by_posts",
    "ascending_order",
  );
  expect(
    parseForumThread(html, url, "901").posts.every((p) => !p.parentId),
  ).toBe(true);
});
test("unknown layouts are reported and missing counts remain unknown", () => {
  expect(
    parseForumThread("<h1>Permission denied</h1>", url, "901").recognized,
  ).toBe(false);
  expect(
    parseForumOverview("<h1>Custom forum</h1>", url, "402").recognized,
  ).toBe(false);
  const forum = parseForumOverview(
    '<div class="il-item"><h3 class="il-item-title"><a href="ilias.php?ref_id=402&thr_pk=901&cmd=viewThread">Topic</a></h3></div>',
    url,
    "402",
  );
  expect(forum.topics[0].unread).toBeNull();
});
test("forum navigation preserves ILIAS routing tokens and strips actions that could mutate a thread", () => {
  const source = url + "&action=showreply&mark_read=1&pos_pk=99&file=hash";
  const target = new URL(
    forumViewUrl(FREIBURG, source, "402", "901", 2, "newest"),
  );
  expect(target.searchParams.get("cmdNode")).toBe("a:b");
  expect(target.searchParams.get("viewmode")).toBe("3");
  expect(target.searchParams.get("page")).toBe("2");
  expect(target.searchParams.has("mark_read")).toBe(false);
  expect(target.searchParams.has("action")).toBe(false);
  expect(target.searchParams.has("file")).toBe(false);
  expect(() =>
    forumViewUrl(
      FREIBURG,
      "https://other.example/ilias.php",
      "402",
      "901",
      0,
      "conversation",
    ),
  ).toThrow();
});
test("authenticated forum requests discover the real controller before loading a scoped thread page", async () => {
  const calls: string[] = [];
  globalThis.fetch = mock(async (input: Parameters<typeof fetch>[0]) => {
    const target = String(input);
    calls.push(target);
    if (target.includes("goto.php"))
      return new Response(null, { status: 302, headers: { location: url } });
    const html = await fixture(
      target.includes("cmd=viewThread") ? "forum-thread" : "forum",
    );
    return new Response(html, { headers: { "content-type": "text/html" } });
  }) as unknown as typeof fetch;
  const result = await fetchForum(
    {
      id: "00000000-0000-0000-0000-000000000000",
      instance: FREIBURG,
      status: "pending",
      createdAt: Date.now(),
    },
    "402",
    "901",
    1,
    "conversation",
  );
  expect(result.thread?.posts).toHaveLength(4);
  expect(new URL(calls.at(-1)!).searchParams.get("page")).toBe("1");
  expect(calls).toHaveLength(3);
});

test("links written inside a post cannot impersonate ILIAS action controls", () => {
  const html = `<ul id="ilFrmPostList"><li><div class="ilFrmPostContentContainer"><a id="1001"></a><div class="ilFrmPostContent"><a href="ilias.php?ref_id=402&thr_pk=901&cmd=viewThread&mark_read=1">Mark read</a><a href="ilias.php?ref_id=402&thr_pk=901&cmd=createTopLevelPost">Reply</a><a href="ilias.php?ref_id=402&thr_pk=901&pos_pk=1001&cmd=viewThread&action=showreply">Reply to post</a></div></div></li></ul>`;
  const thread = parseForumThread(html, url + "&thr_pk=901", "901");
  expect(thread.markReadUrl).toBeUndefined();
  expect(thread.replyUrl).toBeUndefined();
  expect(thread.posts[0].replyUrl).toBeUndefined();
});
