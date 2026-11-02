import type { ForumOverview, ForumThread, ForumPost } from "./forum-types";
const base = "https://ilias.uni-freiburg.de/";
const forumId = "402";
const root = `${base}goto.php?target=frm_${forumId}`;
export function demoForum(): ForumOverview {
  return {
    id: forumId,
    title: "Questions & discussion",
    description:
      "Introduction to Computer Science · Ask a question. Share an idea. Find your people.",
    sourceUrl: root,
    createUrl: base,
    pages: [],
    paginationDetected: false,
    recognized: true,
    topics: [
      {
        id: "901",
        title: "Start here: a good place to ask",
        author: "Dr. Lena Weber",
        posts: 2,
        unread: 0,
        lastActivity: "02 Nov 2026, 09:00",
        pinned: true,
        closed: false,
        sourceUrl: base,
      },
      {
        id: "902",
        title: "Why does binary search need a sorted array?",
        author: "Maya Chen",
        posts: 4,
        unread: 2,
        lastActivity: "02 Nov 2026, 10:15",
        pinned: false,
        closed: false,
        sourceUrl: base,
      },
      {
        id: "903",
        title: "Looking for a study group for sheet 01",
        author: "Jonas Becker",
        posts: 3,
        unread: 1,
        lastActivity: "01 Nov 2026, 16:30",
        pinned: false,
        closed: false,
        sourceUrl: base,
      },
      {
        id: "904",
        title: "Which notation should we use for pseudocode?",
        author: "Sam Keller",
        posts: 1,
        unread: 0,
        lastActivity: "31 Oct 2026, 11:10",
        pinned: false,
        closed: false,
        sourceUrl: base,
      },
      {
        id: "905",
        title: "Week 1: lecture room change",
        author: "Dr. Lena Weber",
        posts: 1,
        unread: 0,
        lastActivity: "28 Oct 2026, 08:00",
        pinned: false,
        closed: true,
        sourceUrl: base,
      },
    ],
  };
}
export function demoThread(id: string): ForumThread | null {
  const topic = demoForum().topics.find((t) => t.id === id);
  if (!topic) return null;
  const post = (
    postId: string,
    author: string,
    body: string,
    depth = 0,
    options: Partial<ForumPost> = {},
  ): ForumPost => ({
    id: postId,
    title: depth ? `Re: ${topic.title}` : topic.title,
    author,
    date: "02 Nov 2026, 09:30",
    body,
    text: body.replace(/<[^>]+>/g, " "),
    depth,
    unread: false,
    moderator: false,
    status: "",
    attachments: [],
    hasEmbeddedContent: false,
    sourceUrl: `${root}_${id}#${postId}`,
    replyUrl: topic.closed ? undefined : base,
    ...options,
  });
  const content: Record<string, ForumPost[]> = {
    "901": [
      post(
        "1001",
        "Dr. Lena Weber",
        "<p>Welcome! This is our space for questions about lectures, exercises, and everything in between.</p><ul><li>Use a clear title so others can find your question.</li><li>Show what you have tried. A small example helps.</li><li>Be generous with your explanations. We all start somewhere.</li></ul><p>You do not need to have the perfect question to join in.</p>",
        0,
        { moderator: true },
      ),
      post(
        "1002",
        "Alex",
        "<p>Thanks! Looking forward to learning together.</p>",
        1,
        { parentId: "1001" },
      ),
    ],
    "902": [
      post(
        "1011",
        "Maya Chen",
        "<p>I understand that binary search discards half the array at each step, but I am not sure why the array has to be sorted.</p><p>If we always check the middle element, would it still work on something like this?</p><pre><code>[8, 2, 11, 4, 6, 1, 9]</code></pre><p>What exactly goes wrong when we search for <code>2</code>?</p>",
      ),
      post(
        "1012",
        "Jonas Becker",
        "<p>The middle element is <code>4</code>. Since <code>2 &lt; 4</code>, binary search would choose the left half.</p><p>That happens to work here, but imagine searching for <code>1</code>: it is smaller than <code>4</code> but lives in the right half, which we just threw away.</p>",
        1,
        { parentId: "1011", date: "02 Nov 2026, 09:45" },
      ),
      post(
        "1013",
        "Dr. Lena Weber",
        "<blockquote><p>What exactly goes wrong?</p></blockquote><p>The comparison only tells you which half to keep when every element on one side is smaller and every element on the other side is larger. Sorting gives you that guarantee.</p><p>Think of a dictionary: opening it in the middle is useful because the words are already in order.</p><p>The invariant to look for is: <strong>if the value exists, it must still be inside the remaining interval.</strong></p>",
        2,
        {
          parentId: "1012",
          moderator: true,
          unread: true,
          date: "02 Nov 2026, 10:00",
        },
      ),
      post(
        "1014",
        "Maya Chen",
        "<p>The example with <code>1</code> makes it click. Without sorting, comparing against the middle tells us nothing about the other elements.</p><p>Thank you both!</p>",
        1,
        { parentId: "1011", unread: true, date: "02 Nov 2026, 10:15" },
      ),
    ],
    "903": [
      post(
        "1021",
        "Jonas Becker",
        "<p>Would anyone like to work through the first sheet together? I am free on Wednesday afternoon.</p>",
      ),
      post(
        "1022",
        "Maya Chen",
        "<p>Wednesday works for me. The library study rooms would be a good place.</p>",
        1,
        { parentId: "1021" },
      ),
      post("1023", "Sam Keller", "<p>I would like to join as well!</p>", 1, {
        parentId: "1021",
        unread: true,
      }),
    ],
    "904": [
      post(
        "1031",
        "Sam Keller",
        "<p>Is it okay to write pseudocode in a Python-like style, or should we follow the notation from the slides exactly?</p>",
      ),
    ],
    "905": [
      post(
        "1041",
        "Dr. Lena Weber",
        "<p>The first lecture will take place in the larger room listed on the course page. Please check the timetable before you travel.</p>",
        0,
        { moderator: true },
      ),
    ],
  };
  return {
    id,
    title: topic.title,
    posts: content[id],
    sourceUrl: `${root}_${id}`,
    replyUrl: topic.closed ? undefined : base,
    markReadUrl: topic.unread ? base : undefined,
    pages: [],
    paginationDetected: false,
    limited: false,
    recognized: true,
  };
}
