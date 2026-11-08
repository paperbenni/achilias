import { fileControllerReference } from "./file-reference";
import { profileName } from "./profile-name";
import { cleanText as clean } from "./text";
import { load, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { Breadcrumb, IliasPage, Item } from "./types";

// Untriggered dialogs and templates hold copies of items that must not parse
// into results or alerts.
const hiddenSelector =
  'template, dialog, [role="dialog"], .modal, .il-modal, [hidden], [aria-hidden="true"], .hidden, .d-none';
const hasHiddenStyle = (style: string | undefined) =>
  /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(style || "");
const hiddenSubtree = ($: CheerioAPI, el: AnyNode) =>
  $(el).closest(hiddenSelector).length > 0 ||
  $(el)
    .parents()
    .addBack()
    .toArray()
    .some((node) => hasHiddenStyle($(node).attr("style")));

// ILIAS 10 renders the page title in the content header. Pages that allow
// drag-and-drop uploads wrap that header in a file dropzone, whose hidden
// upload dialog comes first in the document and is titled "Dateien hochladen".
// Prefer the real header so the dialog's h1 never becomes the page title.
export function readPageTitle($: CheerioAPI): string {
  const header = $(".il-page-content-header").first();
  if (header.length) return clean(header.text());
  const legacy = $("#ilHeader, h1.ilHeader").first();
  if (legacy.length) return clean(legacy.text());
  return clean(
    $("h1")
      .filter(
        (_, el) => !hiddenSubtree($, el) && !$(el).hasClass("modal-title"),
      )
      .first()
      .text(),
  );
}

/** Read the controller and command from an ILIAS tab link without trusting its label. */
function commandTarget(value: string) {
  try {
    const url = new URL(value);
    return {
      baseClass: (url.searchParams.get("baseClass") || "").toLowerCase(),
      cmd: (url.searchParams.get("cmd") || "").toLowerCase(),
    };
  } catch {
    return { baseClass: "", cmd: "" };
  }
}
function isJoinAction(value: string) {
  const { baseClass, cmd } = commandTarget(value);
  return (
    baseClass === "ilcourseregistrationgui" ||
    baseClass === "ilgroupregistrationgui" ||
    cmd === "join"
  );
}
function isLeaveAction(value: string) {
  const { cmd } = commandTarget(value);
  return cmd === "leave" || cmd === "unsubscribe";
}

/** Read an ILIAS repository reference from a target, goto path, or ref_id. */
function referenceFromUrl(url: URL) {
  const target =
    url.searchParams.get("target")?.match(/^([a-z]+)_(\d+)/i) ||
    url.pathname.match(/\/go(?:to(?:\.php)?)?\/([a-z]+)\/(\d+)/i) ||
    url.pathname.match(/goto_(?:[^_]+_)?([a-z]+)_(\d+)/i);
  const fileId = fileControllerReference(url);
  return {
    type: target?.[1]?.toLowerCase() || (fileId ? "file" : undefined),
    id: target?.[2] || fileId || url.searchParams.get("ref_id") || undefined,
  };
}

// ILIAS' container and dashboard templates expose the same list-item structure.
// Keep selectors here so a theme/version adaptation does not leak into the UI.
export function parsePage(html: string, sourceUrl: string): IliasPage {
  const $ = load(html);
  $("script, style, noscript, template").remove();
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
  const external = (href: string) => {
    if (!href.trim() || href.startsWith("#")) return "";
    try {
      const u = new URL(href, source);
      return (u.protocol === "https:" || u.protocol === "http:") &&
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
    // Dashboard/search pages can contain item templates inside untriggered
    // dialogs. They are not visible content and must not enter search results.
    if (hiddenSubtree($, el)) return;
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
    const rawHref = titleNode.attr("href") || "";
    const href = resolve(rawHref);
    const externalHref = external(rawHref);
    const icon = row
      .find(
        'img.ilListItemIcon, img[src*="icon_"], .il-card-repository-head img, svg use',
      )
      .first();
    const iconPath = icon.attr("src") || icon.attr("href") || "";
    const iconType = iconPath.match(/icon_([a-z]+)(?:\.|_)/i)?.[1];
    const reference = href ? referenceFromUrl(new URL(href)) : undefined;
    const targetType = reference?.type;
    let id = reference?.id;
    id ||= (row.attr("id") || row.attr("data-list-item-id") || "").match(
      /(?:lg_div_|item_)(\d+)/,
    )?.[1];
    if (!id) return;
    const type = (targetType || iconType || "unknown").toLowerCase();
    const webLink = type === "webr";
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    // Standard ILIAS search results and shy items expose labelled properties.
    // The repository path is what distinguishes identically named objects.
    const properties: { name: string; value: string }[] = [];
    row.find(".il-item-property-name").each((_, node) => {
      const name = clean($(node).text()).replace(/:$/, "");
      const value = clean($(node).next(".il-item-property-value").text());
      if (name && value) properties.push({ name, value });
    });
    const context = properties.find((property) =>
      /^(?:path|pfad)$/i.test(property.name),
    )?.value;
    const propertyDescription = properties.find((property) =>
      /^(?:description|beschreibung)$/i.test(property.name),
    )?.value;
    const propertyMeta = properties
      .filter(
        (property) =>
          !/^(?:path|pfad|description|beschreibung)$/i.test(property.name),
      )
      .map((property) => `${property.name}: ${property.value}`)
      .join(" · ");
    items.push({
      id,
      type,
      title,
      description:
        clean(
          row
            .find(".il_Description, .il-item-description, .il-card-description")
            .first()
            .text(),
        ) ||
        propertyDescription ||
        "",
      meta:
        propertyMeta ||
        clean(
          row.find(".il_ItemProperties, .il-item-properties").first().text(),
        ),
      ...(context ? { context: context.slice(0, 1000) } : {}),
      sourceUrl: webLink && externalHref ? externalHref : href || sourceUrl,
      available: Boolean(
        titleNode.length && (href || (webLink && externalHref)),
      ),
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
  const joinUrl = tools.find((tool) => isJoinAction(tool.url))?.url;
  const leaveUrl = tools.find((tool) => isLeaveAction(tool.url))?.url;
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
  // Dialog templates are often present on the dashboard before any action.
  // Their prompts are not page notifications and must not become live alerts.
  const notices = $(".alert, .il-message, .ilFailureMessage, .ilInfoMessage")
    .filter((_, node) => !hiddenSubtree($, node))
    .map((_, el) => clean($(el).text()))
    .get()
    .filter(
      (value, index, notices) => !!value && notices.indexOf(value) === index,
    );
  const avatar = $(".il-maincontrols-metabar .il-avatar").first();
  const userName =
    [avatar.attr("aria-label"), avatar.attr("title"), avatar.attr("alt")]
      .map(profileName)
      .find(Boolean) || "";
  // ILIAS uses either UI-framework crumbs or the legacy locator's list items.
  // Prefer the modern trail when both are rendered; combining them duplicates
  // ancestors. Keep object references so the app can link back to each parent.
  const breadcrumbs: Breadcrumb[] = [];
  const modernCrumbs = $(".breadcrumb_wrapper .crumb, .breadcrumbs .crumb")
    .filter((_, el) => !hiddenSubtree($, el));
  const crumbNodes = modernCrumbs.length
    ? modernCrumbs
    : $("ol.breadcrumb > li").filter((_, el) => !hiddenSubtree($, el));
  crumbNodes.each((_, el) => {
    const node = $(el);
    const title = clean(node.text());
    if (!title) return;
    const link = node.find("a[href]").first();
    const crumbUrl = resolve(link.attr("href") || "");
    const reference = crumbUrl
      ? referenceFromUrl(new URL(crumbUrl))
      : undefined;
    breadcrumbs.push({
      title,
      ...(reference?.type ? { type: reference.type } : {}),
      ...(reference?.id ? { id: reference.id } : {}),
      ...(crumbUrl ? { sourceUrl: crumbUrl } : {}),
    });
  });
  return {
    title:
      readPageTitle($) ||
      clean($("title").text()).replace(/:.*$/, "") ||
      "Learning space",
    description: clean($("#il_description, .ilHeaderDesc").first().text()),
    items,
    tools,
    text: text.slice(0, 40),
    notices,
    breadcrumbs,
    sourceUrl,
    authenticated,
    userName,
    hasMore:
      $(
        '.il-viewcontrol-pagination, .ilTableNav, .il-pagination, [class*="pagination"]',
      ).length > 0,
    ...(joinUrl ? { joinUrl } : {}),
    ...(leaveUrl ? { leaveUrl } : {}),
  };
}
