import { load } from "cheerio";
import { dashboardUrl, FREIBURG, upstreamUrl } from "./config";
import {
  fetchAuthenticatedHtml,
  fetchUpstream,
  readUpstreamText,
  IliasError,
} from "./client";
import { demoSearchItems } from "./demo";
import { itemKey, typeNames } from "./items";
import { parsePage } from "./parser";
import type { Session } from "./session";
import type { Item } from "./types";

export type SearchResults = {
  results: Item[];
  sourceUrl: string;
  hasMore: boolean;
};

export const searchResultLimit = 40;

/** Demo search deliberately includes duplicate names in different course paths. */
export function searchDemo(
  query: string,
  instance = FREIBURG,
): SearchResults {
  const normalized = query.trim().toLowerCase();
  if (!normalized)
    return { results: [], sourceUrl: instance, hasMore: false };
  const terms = normalized.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const matches = demoSearchItems().filter((item) => {
    const key = itemKey(item);
    if (seen.has(key)) return false;
    const haystack = [
      item.title,
      item.description,
      item.meta,
      item.context,
      item.id,
      typeNames[item.type],
    ]
      .join(" ")
      .toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) return false;
    seen.add(key);
    return true;
  });
  const rank = (item: Item) => {
    const title = item.title.toLowerCase();
    return title === normalized
      ? 0
      : title.startsWith(normalized)
        ? 1
        : title.includes(normalized)
          ? 2
          : 3;
  };
  matches.sort(
    (a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title),
  );
  return {
    results: matches.slice(0, searchResultLimit),
    sourceUrl: instance,
    hasMore: matches.length > searchResultLimit,
  };
}

/**
 * Use ILIAS' own main-menu search instead of crawling every course. The search
 * form action is discovered from the authenticated dashboard; its POST is
 * read-only and is the only form the upstream client may submit without a
 * write allowlist.
 */
export async function searchRepository(
  session: Session,
  query: string,
): Promise<SearchResults> {
  const dashboard = await fetchAuthenticatedHtml(
    session,
    dashboardUrl(session.instance),
  );
  const $ = load(dashboard.html);
  const form = $("#mm_search_form").first();
  const action = form.attr("action") || "";
  if (!form.length || !action)
    throw new IliasError(
      "ILIAS did not offer its repository search. Use the original search page.",
    );
  let actionUrl: URL;
  try {
    actionUrl = upstreamUrl(
      session.instance,
      new URL(action, dashboard.url).href,
    );
  } catch {
    throw new IliasError("ILIAS offered an unsafe search form.", 502);
  }
  const fields = new URLSearchParams();
  form.find('input[type="hidden"][name]').each((_, node) => {
    const name = $(node).attr("name");
    const value = $(node).attr("value");
    if (name && value !== undefined && !fields.has(name))
      fields.append(name, value);
  });
  const root = form.find('input[name="root_id"]').first().attr("value") || "";
  fields.set("root_id", /^[1-9]\d{0,11}$/.test(root) ? root : "1");
  fields.set("queryString", query);
  const { response, url } = await fetchUpstream(
    session,
    actionUrl.href,
    { form: fields, readOnlyForm: true },
  );
  if (!(response.headers.get("content-type") || "").includes("text/html")) {
    await response.body?.cancel();
    throw new IliasError(
      "ILIAS did not return search results. Use the original search page.",
    );
  }
  const html = await readUpstreamText(response);
  const page = parsePage(html, url);
  if (!page.authenticated)
    throw new IliasError(
      "Your ILIAS session has expired. Reconnect your account.",
      401,
    );
  return {
    results: page.items,
    sourceUrl: url,
    hasMore: page.hasMore,
  };
}
