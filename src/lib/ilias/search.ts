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
  page: number;
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
/** `switchResultPage` renders whatever search ILIAS has cached for the
 * session, so a later page must belong to the query the user is looking at. */
const lastSearches = new Map<string, { query: string; at: number }>();
const maxSearchPage = 5;

export function clearSearchFormCache(sessionId?: string) {
  if (sessionId === undefined) {
    searchForms.clear();
    discovering.clear();
    lastSearches.clear();
    return;
  }
  searchForms.delete(sessionId);
  discovering.delete(sessionId);
  lastSearches.delete(sessionId);
}

/** Demo search deliberately includes duplicate names in different course paths. */
export function searchDemo(
  query: string,
  instance = FREIBURG,
): SearchResults {
  if (!query.trim())
    return { results: [], sourceUrl: instance, hasMore: false, page: 1 };
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
    page: 1,
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

/** ILIAS pages search results through `switchResultPage`, a read-only command
 * that re-renders the cached search at another offset. Only the ILIAS 10
 * controller shape keeps the executed command in the action URL; older
 * releases leave it to ilCtrl's `fallbackCmd`, so they stay on the single page
 * ILIAS returned and keep the handoff to the original search. */
function pagingAction(form: SearchForm, page: number) {
  if (page < 2) return null;
  const action = new URL(form.action);
  if (
    action.searchParams.get("baseClass")?.toLowerCase() !== "ilsearchcontrollergui"
  )
    return null;
  action.searchParams.set("cmd", "switchResultPage");
  action.searchParams.delete("fallbackCmd");
  // ILIAS' view control is 0-indexed while its search cache is 1-indexed.
  action.searchParams.set("page_number", String(page - 1));
  return action;
}

/**
 * Use ILIAS' own main-menu search instead of crawling every course. The search
 * form action is discovered from the authenticated dashboard; its POST is
 * read-only and is the only form the upstream client may submit without a
 * write allowlist. Further result pages are read-only GETs of the same search.
 */
export async function searchRepository(
  session: Session,
  query: string,
  pageNumber = 1,
): Promise<SearchResults> {
  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > maxSearchPage
  )
    throw new IliasError("That search page does not exist.", 400);
  if (pageNumber > 1) {
    const last = lastSearches.get(session.id);
    if (
      !last ||
      last.query !== query ||
      Date.now() - last.at > searchFormTtl
    )
      throw new IliasError("That search expired. Start it again.", 409);
  }
  const form = await discoverSearchForm(session);
  const action = pagingAction(form, pageNumber);
  if (pageNumber > 1 && !action)
    throw new IliasError("That search expired. Start it again.", 409);
  let upstream =
    pageNumber > 1 && action
      ? await fetchUpstream(session, action.href)
      : await submitSearch(session, form, query);
  if (pageNumber === 1)
    lastSearches.set(session.id, { query, at: Date.now() });
  let results = await readSearchResults(upstream);
  const echoed = echoedTerm(results.html);
  if (echoed !== null && echoed !== query) {
    // ilCtrl falls back to the saved search when it ignores the token; never
    // pass that page off as this query's results.
    if (pageNumber > 1)
      throw new IliasError("That search expired. Start it again.", 409);
    clearSearchFormCache(session.id);
    upstream = await submitSearch(session, await discoverSearchForm(session), query);
    lastSearches.set(session.id, { query, at: Date.now() });
    results = await readSearchResults(upstream);
  }
  const page = parsePage(results.html, results.url);
  if (!page.authenticated)
    throw new IliasError(
      "Your ILIAS session has expired. Reconnect your account.",
      401,
    );
  return {
    results: page.items,
    sourceUrl: results.url,
    hasMore:
      Boolean(pagingAction(form, pageNumber + 1)) &&
      page.items.length > 0 &&
      pageNumber < maxSearchPage,
    page: pageNumber,
  };
}
