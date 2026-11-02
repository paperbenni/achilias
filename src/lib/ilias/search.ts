import { load } from "cheerio";
import { dashboardUrl, FREIBURG, upstreamUrl } from "./config";
import {
  fetchAuthenticatedHtml,
  fetchUpstream,
  readUpstreamText,
  IliasError,
} from "./client";
import { demoSearchItems } from "./demo";
import { itemKey } from "./items";
import { matchesItem, rankByTitle, searchTerms } from "./item-search";
import { parsePage } from "./parser";
import type { Session } from "./session";
import type { Item } from "./types";

export type SearchResults = {
  results: Item[];
  sourceUrl: string;
  hasMore: boolean;
};

export const searchResultLimit = 40;

type SearchForm = {
  instance: string;
  action: string;
  rootId: string;
  fields: [string, string][];
};

/** The main-menu form, its hidden fields and its CSRF token are the same for
 * every query in an ILIAS session, so rediscovering them per query would spend
 * a whole dashboard download and parse on nothing. */
const searchFormTtl = 5 * 60_000;
const searchForms = new Map<string, { form: SearchForm; expiresAt: number }>();
const discovering = new Map<string, Promise<SearchForm>>();

export function clearSearchFormCache(sessionId?: string) {
  if (sessionId === undefined) {
    searchForms.clear();
    discovering.clear();
    return;
  }
  searchForms.delete(sessionId);
  discovering.delete(sessionId);
}

/** Demo search deliberately includes duplicate names in different course paths. */
export function searchDemo(
  query: string,
  instance = FREIBURG,
): SearchResults {
  if (!query.trim())
    return { results: [], sourceUrl: instance, hasMore: false };
  const terms = searchTerms(query);
  const seen = new Set<string>();
  const matches = demoSearchItems().filter((item) => {
    const key = itemKey(item);
    if (seen.has(key)) return false;
    if (!matchesItem(item, terms)) return false;
    seen.add(key);
    return true;
  });
  const ranked = rankByTitle(matches, query);
  return {
    results: ranked.slice(0, searchResultLimit),
    sourceUrl: instance,
    hasMore: ranked.length > searchResultLimit,
  };
}

async function readSearchForm(session: Session): Promise<SearchForm> {
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
  const fields: [string, string][] = [];
  form.find('input[type="hidden"][name]').each((_, node) => {
    const name = $(node).attr("name");
    const value = $(node).attr("value");
    if (name && value !== undefined && !fields.some(([key]) => key === name))
      fields.push([name, value]);
  });
  const root = form.find('input[name="root_id"]').first().attr("value") || "";
  return {
    instance: session.instance,
    action: actionUrl.href,
    rootId: /^[1-9]\d{0,11}$/.test(root) ? root : "1",
    fields,
  };
}

async function discoverSearchForm(session: Session): Promise<SearchForm> {
  const cached = searchForms.get(session.id);
  if (
    cached?.form.instance === session.instance &&
    cached.expiresAt > Date.now()
  )
    return cached.form;
  // Concurrent queries for one account share a single dashboard download.
  const shared = discovering.get(session.id);
  if (shared) {
    const form = await shared.catch(() => null);
    if (form && form.instance === session.instance) return form;
  }
  const task = readSearchForm(session);
  discovering.set(session.id, task);
  try {
    const form = await task;
    searchForms.set(session.id, {
      form,
      expiresAt: Date.now() + searchFormTtl,
    });
    return form;
  } catch (error) {
    clearSearchFormCache(session.id);
    throw error;
  } finally {
    if (discovering.get(session.id) === task) discovering.delete(session.id);
  }
}

async function submitSearch(session: Session, form: SearchForm, query: string) {
  const fields = new URLSearchParams(form.fields);
  fields.set("root_id", form.rootId);
  fields.set("queryString", query);
  try {
    return await fetchUpstream(session, form.action, {
      form: fields,
      readOnlyForm: true,
    });
  } catch (error) {
    // The cached action may carry a token ILIAS no longer honours.
    clearSearchFormCache(session.id);
    throw error;
  }
}

async function readSearchResults(upstream: {
  response: Response;
  url: string;
}) {
  if (
    !(upstream.response.headers.get("content-type") || "").includes("text/html")
  ) {
    await upstream.response.body?.cancel();
    throw new IliasError(
      "ILIAS did not return search results. Use the original search page.",
    );
  }
  return { html: await readUpstreamText(upstream.response), url: upstream.url };
}

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  "#039": "'",
};

/** ILIAS echoes the submitted term in the result toolbar. When a cached token
 * is no longer honoured, ilCtrl falls back to the saved search and would
 * otherwise pass off the previous query's results as this query's. */
function echoedTerm(html: string) {
  const match = html.match(/id="search_field"[^>]{0,200}?value="([^"]*)"/i);
  if (!match) return null;
  return match[1].replace(
    /&(amp|lt|gt|quot|apos|#0?39);/gi,
    (entity, name: string) =>
      entities[name.toLowerCase()] ?? entities[`#${name.replace(/\D/g, "")}`] ?? entity,
  );
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
  let form = await discoverSearchForm(session);
  let results = await readSearchResults(await submitSearch(session, form, query));
  const echoed = echoedTerm(results.html);
  if (echoed !== null && echoed !== query) {
    // Re-discover once, then trust the second response.
    clearSearchFormCache(session.id);
    form = await discoverSearchForm(session);
    results = await readSearchResults(await submitSearch(session, form, query));
  }
  const page = parsePage(results.html, results.url);
  if (!page.authenticated)
    throw new IliasError(
      "Your ILIAS session has expired. Reconnect your account.",
      401,
    );
  return {
    results: page.items.slice(0, searchResultLimit),
    sourceUrl: results.url,
    hasMore: page.hasMore || page.items.length > searchResultLimit,
  };
}
