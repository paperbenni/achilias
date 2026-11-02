import { load } from "cheerio";
import type { IliasPage, Item } from "./types";
const clean = (text: string) => text.replace(/\s+/g, " ").trim();

// ILIAS' container and dashboard templates expose the same list-item structure.
// Keep selectors here so a theme/version adaptation does not leak into the UI.
export function parsePage(html: string, sourceUrl: string): IliasPage {
  const $ = load(html);
  $("script, style, noscript").remove();
  const source = new URL(sourceUrl);
  const resolve = (href: string) => {
    if (!href.trim() || href.startsWith("#")) return "";
    try {
      const u = new URL(href, source);
      return u.protocol === "https:" &&
        u.origin === source.origin &&
        !u.username &&
        !u.password
        ? u.href
        : "";
    } catch {
      return "";
    }
  };
  const logout =
    $("a[href], button[data-action]").filter((_, el) =>
      /(?:logout\.php|baseclass=illogoutgui|cmd=logout)/i.test(
        $(el).attr("href") || $(el).attr("data-action") || "",
      ),
    ).length > 0 || $(".glyphicon-logout").length > 0;
  const loginForm =
    $("form").filter((_, el) =>
      /(?:doStandardAuthentication|shib_login|login\.php)/i.test(
        $(el).attr("action") || "",
      ),
    ).length > 0;
  const authenticated = logout && !loginForm;
  const items: Item[] = [];
  const seen = new Set<string>();
  const nodes = $(
    ".ilContainerListItemOuter, .ilContainerListItem, .il-card, .il-item",
  );
  nodes.each((_, el) => {
    const row = $(el);
    // Avoid processing the inner wrapper of an already parsed list item.
    if (row.parents(".ilContainerListItemOuter").length) return;
    const titleNode = row
      .find(
        "a.il_ContainerItemTitle, .il-item-title a, .il-card-title a, .caption.card-title a, .caption h3 a, h3 a, h4 a",
      )
      .first();
    const heading = titleNode.length
      ? titleNode
      : row
          .find(
            "h3.il_ContainerItemTitle, .il-item-title, .il-card-title, .caption.card-title, .caption h3",
          )
          .first();
    const title = clean(heading.text());
    if (!title) return;
    const href = resolve(titleNode.attr("href") || "");
    const icon = row
      .find(
        'img.ilListItemIcon, img[src*="icon_"], .il-card-repository-head img, svg use',
      )
      .first();
    const iconPath = icon.attr("src") || icon.attr("href") || "";
    const iconType = iconPath.match(/icon_([a-z]+)(?:\.|_)/i)?.[1];
    let targetType: string | undefined;
    let id: string | undefined;
    if (href) {
      const u = new URL(href);
      const target =
        u.searchParams.get("target")?.match(/^([a-z]+)_(\d+)/i) ||
        u.pathname.match(/\/goto\.php\/([a-z]+)\/(\d+)/i) ||
        u.pathname.match(/goto_(?:[^_]+_)?([a-z]+)_(\d+)/i);
      targetType = target?.[1];
      id = target?.[2] || u.searchParams.get("ref_id") || undefined;
    }
    id ||= (row.attr("id") || row.attr("data-list-item-id") || "").match(
      /(?:lg_div_|item_)(\d+)/,
    )?.[1];
    if (!id) return;
    const type = (targetType || iconType || "unknown").toLowerCase();
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      id,
      type,
      title,
      description: clean(
        row
          .find(".il_Description, .il-item-description, .il-card-description")
          .first()
          .text(),
      ),
      meta: clean(
        row.find(".il_ItemProperties, .il-item-properties").first().text(),
      ),
      sourceUrl: href || sourceUrl,
      available: Boolean(titleNode.length && href),
    });
  });
  const tools: IliasPage["tools"] = [];
  $('#ilTab a[href], .il-tabs a[href], [role="tablist"] a[href]').each(
    (_, el) => {
      const title = clean($(el).text());
      const url = resolve($(el).attr("href") || "");
      if (title && url && !tools.some((t) => t.title === title))
        tools.push({ title, url });
    },
  );
  const text: string[] = [];
  $(".ilc_Paragraph, .ilc_heading1, .ilc_heading2, .ilc_heading3").each(
    (_, el) => {
      if (
        $(el).parents(".ilContainerListItemOuter, .il-item, nav, footer").length
      )
        return;
      const value = clean($(el).text());
      if (value && value.length > 2 && !text.includes(value))
        text.push(value.slice(0, 4000));
    },
  );
  const notices = $(".alert, .il-message, .ilFailureMessage, .ilInfoMessage")
    .map((_, el) => clean($(el).text()))
    .get()
    .filter(Boolean);
  const userName = clean(
    $(".il-maincontrols-metabar .il-avatar").first().attr("aria-label") ||
      $(".il-maincontrols-metabar img.il-avatar").first().attr("alt") ||
      "",
  );
  return {
    title:
      clean($("#ilHeader, .ilHeader h1, h1.ilHeader, h1").first().text()) ||
      clean($("title").text()).replace(/:.*$/, "") ||
      "Learning space",
    description: clean($("#il_description, .ilHeaderDesc").first().text()),
    items,
    tools,
    text: text.slice(0, 40),
    notices,
    sourceUrl,
    authenticated,
    userName,
    hasMore:
      $(
        '.il-viewcontrol-pagination, .ilTableNav, .il-pagination, [class*="pagination"]',
      ).length > 0,
  };
}
