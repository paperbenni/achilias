import { load, type CheerioAPI } from "cheerio";
import sanitizeHtml from "sanitize-html";
import { upstreamUrl } from "./config";
import type {
  ForumOverview,
  ForumPageLink,
  ForumPost,
  ForumThread,
  ForumTopic,
} from "./forum-types";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const idPattern = /^[1-9]\d{0,11}$/;
export function forumLink(href: string, sourceUrl: string) {
  try {
    if (!href.trim() || href.startsWith("#")) return undefined;
    const source = new URL(sourceUrl);
    const u = upstreamUrl(
      new URL("./", source).href,
      new URL(href, source).href,
    );
    if (u.protocol !== "https:") return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}
function targets($: CheerioAPI, selector: string, sourceUrl: string) {
  return $(selector)
    .toArray()
    .flatMap((el) => {
      const url = forumLink(
        $(el).attr("href") || $(el).attr("data-action") || "",
        sourceUrl,
      );
      return url
        ? [{ url, element: $(el), params: new URL(url).searchParams }]
        : [];
    });
}
function pages(
  $: CheerioAPI,
  sourceUrl: string,
  threadId?: string,
): ForumPageLink[] {
  const ref = new URL(sourceUrl).searchParams.get("ref_id");
  const result = targets(
    $,
    ".il-viewcontrol-pagination a, .il-viewcontrol-pagination button, .ilTableNav a",
    sourceUrl,
  )
    .filter(({ params }) => {
      const cmd = (params.get("cmd") || "").toLowerCase();
      return (
        (!cmd || cmd === (threadId ? "viewthread" : "showthreads")) &&
        !params.has("mark_read") &&
        !params.has("action") &&
        !params.has("file") &&
        (!ref || params.get("ref_id") === ref) &&
        (!threadId || params.get("thr_pk") === threadId)
      );
    })
    .map(({ params }) => params.get("page"))
    .filter((p): p is string => p !== null && /^\d{1,5}$/.test(p))
    .map((p) => Number(p));
  return [...new Set(result)].sort((a, b) => a - b).map((page) => ({ page }));
}
function action(
  $: CheerioAPI,
  sourceUrl: string,
  commands: string[],
  scope?: { threadId: string; postId?: string },
) {
  const ref = new URL(sourceUrl).searchParams.get("ref_id");
  return targets($, "a[href], button[data-action]", sourceUrl).find(
    ({ params }) => {
      if (ref && params.get("ref_id") !== ref) return false;
      if (scope && params.get("thr_pk") !== scope.threadId) return false;
      if (scope?.postId && params.get("pos_pk") !== scope.postId) return false;
      return commands.includes((params.get("cmd") || "").toLowerCase());
    },
  )?.url;
}
export function sanitizeForumBody(html: string, sourceUrl: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "blockquote",
      "pre",
      "code",
      "ul",
      "ol",
      "li",
      "a",
      "h2",
      "h3",
      "h4",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "sub",
      "sup",
      "span",
      "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      ol: ["start"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attrs) => {
        let href: string | undefined;
        try {
          const u = new URL(attrs.href || "", sourceUrl);
          if (
            ["https:", "http:", "mailto:"].includes(u.protocol) &&
            !u.username &&
            !u.password
          )
            href = u.href;
        } catch {
          /* Drop malformed links. */
        }
        return {
          tagName: "a",
          attribs: href
            ? {
                href,
                target: "_blank",
                rel: "noopener noreferrer",
                ...(attrs.title ? { title: attrs.title } : {}),
              }
            : {},
        };
      },
    },
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "option",
      "iframe",
      "object",
      "embed",
      "svg",
      "math",
    ],
  });
}
export function parseForumOverview(
  html: string,
  sourceUrl: string,
  forumId: string,
): ForumOverview {
  const $ = load(html);
  $("script, style").remove();
  const topics: ForumTopic[] = [];
  const seen = new Set<string>();
  // ILIAS 10 uses standard items. Older themes retain the table layout.
  $(".il-item, tr").each((_, el) => {
    const row = $(el);
    const node = row
      .find(".il-item-title a, td a[href]")
      .filter((_, a) => {
        const url = forumLink($(a).attr("href") || "", sourceUrl);
        if (!url) return false;
        const p = new URL(url).searchParams;
        return (
          (p.get("cmd") || "").toLowerCase() === "viewthread" &&
          idPattern.test(p.get("thr_pk") || "") &&
          (!p.has("ref_id") || p.get("ref_id") === forumId)
        );
      })
      .first();
    if (!node.length) return;
    const url = forumLink(node.attr("href") || "", sourceUrl)!;
    const id = new URL(url).searchParams.get("thr_pk")!;
    if (seen.has(id)) return;
    seen.add(id);
    const properties: Record<string, string> = {};
    row.find(".il-item-property-name").each((_, name) => {
      properties[clean($(name).text()).toLowerCase().replace(/:$/, "")] = clean(
        $(name).siblings(".il-item-property-value").first().text(),
      );
    });
    const property = (pattern: RegExp) =>
      Object.entries(properties).find(([k]) => pattern.test(k))?.[1] || "";
    let author = property(/created by|erstellt von|autor|author/);
    let stats = property(/^(posts|postings|articles|beitr[aä]ge)$/);
    let lastActivity = property(
      /last post|letzte[rn]? beitrag|letzter eintrag/,
    );
    if (row.is("tr")) {
      const cells = row.children("td");
      const titleCell = node.closest("td").index();
      author ||= clean(cells.eq(titleCell + 1).text());
      stats ||= clean(cells.eq(titleCell + 2).text());
      lastActivity ||= clean(cells.eq(-1).text());
    }
    const count = stats.match(/^\s*(\d+)/)?.[1];
    const unread =
      stats.match(/(?:unread|ungelesen)\s*:\s*(\d+)/i)?.[1] ||
      stats.match(/(\d+)\s+(?:unread|ungelesen)/i)?.[1];
    const titleText = clean(node.text());
    topics.push({
      id,
      title: titleText,
      author,
      posts: count ? Number(count) : null,
      unread: unread ? Number(unread) : count ? 0 : null,
      lastActivity,
      pinned:
        row.hasClass("il-item-marker") ||
        /tblstickyrow/.test(row.attr("class") || "") ||
        /sticky|angepinnt|wichtig|top.thema/i.test(
          property(/relevance|relevanz/),
        ),
      closed: /\((?:closed|geschlossen)\)\s*$/i.test(titleText),
      sourceUrl: url,
    });
  });
  return {
    id: forumId,
    title: clean($("#ilHeader, h1").first().text()) || "Discussion forum",
    description: clean($("#il_description, .ilHeaderDesc").first().text()),
    topics,
    sourceUrl,
    createUrl: action($, sourceUrl, ["createthread"]),
    pages: pages($, sourceUrl),
    paginationDetected: $(".il-viewcontrol-pagination, .ilTableNav").length > 0,
    recognized:
      $('.il-panel-listing, .il-panel-listing-std, .il-item, table[id*="frm"]')
        .length > 0 || topics.length > 0,
  };
}
export function parseForumThread(
  html: string,
  sourceUrl: string,
  threadId: string,
): ForumThread {
  const $ = load(html);
  $("script, style").remove();
  const posts: ForumPost[] = [];
  const stack: { id: string; depth: number }[] = [];
  const treeMode = $("#ilFrmPostList").hasClass("sort_by_posts");
  $("#ilFrmPostList > li").each((_, el) => {
    const row = $(el);
    const id = row
      .find(".ilFrmPostContentContainer > a[id]")
      .map((_, a) => $(a).attr("id"))
      .get()
      .find((v) => idPattern.test(v));
    // Draft rows have draft_* anchors and must not look like published replies.
    if (!id) return;
    const raw = row.find(".ilFrmPostContent").first();
    const body = sanitizeForumBody(raw.html() || "", sourceUrl);
    const header = row.find(".ilFrmPostHeader > .small").first().clone();
    header.find(".ilFrmTargetImage").remove();
    const firstLine = load(
      (header.html() || "").split(/<br\s*\/?\s*>/i)[0],
    ).text();
    const parts = clean(firstLine).split(/\s*\|\s*/);
    const date = parts.length > 1 ? parts.at(-1)! : "";
    const author =
      parts.length > 1
        ? parts.slice(0, -1).filter(Boolean).join(" · ")
        : parts[0] || "Author not available";
    const depth = Number(
      (row.attr("class") || "").match(/ilFrmPost-level-(\d+)/)?.[1] || 0,
    );
    while (stack.length && stack.at(-1)!.depth >= depth) stack.pop();
    const parentId = treeMode ? stack.at(-1)?.id : undefined;
    stack.push({ id, depth });
    const attachments = row
      .find(".ilFrmPostAttachmentsContainer a[href]")
      .toArray()
      .flatMap((a) => {
        const url = forumLink($(a).attr("href") || "", sourceUrl);
        return url
          ? [
              {
                title: clean($(a).attr("title") || $(a).text()) || "Attachment",
                url,
              },
            ]
          : [];
      });
    const rowDoc = load(row.html() || "");
    const permalink = new URL(sourceUrl);
    permalink.hash = id;
    posts.push({
      id,
      title: clean(row.find(".ilFrmPostTitle").first().text()),
      author,
      date,
      body,
      text: clean(load(body).text()),
      depth,
      parentId,
      unread: row
        .find(".ilFrmPostTitle a[href]")
        .toArray()
        .some((a) => /cmd=markPostRead/i.test($(a).attr("href") || "")),
      moderator: row.hasClass("ilModeratorPosting"),
      status: clean(
        row
          .find(".ilFrmPostActivationStatus, .ilFrmPostCensorshipAdvice")
          .text(),
      ),
      attachments,
      hasEmbeddedContent:
        raw.find("img, iframe, video, audio, object, embed, svg, math").length >
        0,
      sourceUrl: permalink.href,
      replyUrl: action(rowDoc, sourceUrl, ["viewthread"], {
        threadId,
        postId: id,
      }),
    });
    // viewThread alone is not a reply action. Match ILIAS' action=showreply explicitly.
    const reply = targets(
      rowDoc,
      "a[href], button[data-action]",
      sourceUrl,
    ).find(
      ({ params }) =>
        params.get("action") === "showreply" &&
        params.get("thr_pk") === threadId &&
        params.get("pos_pk") === id,
    );
    posts.at(-1)!.replyUrl = reply?.url;
  });
  const rawTitle = clean($("#ilHeader, h1").first().text());
  const title =
    rawTitle.replace(/^(?:thread|topic|thema)\s*["“„»](.*?)["”«]\s*$/i, "$1") ||
    posts[0]?.title ||
    "Discussion";
  const markRead = targets($, "a[href], button[data-action]", sourceUrl).find(
    ({ params }) =>
      params.get("mark_read") === "1" &&
      params.get("thr_pk") === threadId &&
      (params.get("cmd") || "").toLowerCase() === "viewthread",
  );
  return {
    id: threadId,
    title,
    posts,
    sourceUrl,
    replyUrl: action($, sourceUrl, ["createtoplevelpost"], { threadId }),
    markReadUrl: markRead?.url,
    pages: pages($, sourceUrl, threadId),
    paginationDetected: $(".il-viewcontrol-pagination").length > 0,
    limited: targets($, "a[href], button[data-action]", sourceUrl).some(
      ({ params }) =>
        (params.get("cmd") || "").toLowerCase() === "resetlimitedview",
    ),
    recognized: $("#ilFrmPostList").length > 0,
  };
}
