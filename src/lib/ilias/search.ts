import { load } from "cheerio";
import { dashboardUrl, FREIBURG, upstreamUrl } from "./config";
import {
  fetchAuthenticatedHtml,
  fetchUpstream,
  readUpstreamText,
  IliasError,
} from "./client";
import { demoCourses, demoSearchItems } from "./demo";
import { itemKey } from "./items";
import { matchesItem, rankByTitle, searchTerms } from "./item-search";
import { parsePage } from "./parser";
import type { Session } from "./session";
import type { Item } from "./types";
import { validObjectId } from "./identifiers";

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
 * session, so a later page must belong to the query the user is looking at.
 * Its links are taken from ILIAS' own result view: their token, sortation and
 * routing are what the server issued for that search. */
type SearchPaging = { query: string; root?: string; at: number; links: Map<number, string> };
const lastSearches = new Map<string, SearchPaging>();
const searchQueues = new Map<string, Promise<void>>();
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
  root?: string,
): SearchResults {
  if (!query.trim())
    return { results: [], sourceUrl: instance, hasMore: false, page: 1 };
  const terms = searchTerms(query);
  const course = demoCourses.find((entry) => entry.id === root);
  const seen = new Set<string>();
  const matches = demoSearchItems().filter((item) => {
    if (root) {
      if (course && !item.context?.split("›").map((part) => part.trim()).includes(course.title)) return false;
      if (!course && root === "201" && !item.context?.includes("Lecture materials")) return false;
      if (!course && root !== "201") return false;
    }
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

async function submitSearch(session: Session, form: SearchForm, query: string, root?: string) {
  const fields = new URLSearchParams(form.fields);
  fields.set("root_id", root || form.rootId);
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

/** remoteSearch syncs the effective root into the filter via this onload call. */
function echoedRoot(html: string) {
  return html.match(/il\.Search\.syncFilterScope\(\s*(['"])[^'"]*\1,\s*(['"])(\d+)\2\s*\)/)?.[3] ?? null;
}

/** Read one routing parameter, or null when PHP would see a different value
 * than URLSearchParams does (PHP keeps the last duplicate). */
function routing(url: URL, name: string) {
  const values = url.searchParams.getAll(name);
  return values.length > 1 ? null : (values[0] || "").toLowerCase();
}

/** Collect the result-page links ILIAS rendered for this search. Only the
 * search controller's read-only `switchResultPage` is accepted, and only from
 * the instance itself. ILIAS renders a next link only when another page
 * exists, so this also tells us whether paging is possible at all. */
function pagingLinks(html: string, instance: string, base: string) {
  const links = new Map<number, string>();
  for (const match of html.matchAll(/\shref="([^"]+)"/gi)) {
    const href = match[1]
      .replace(/&amp;|&#0*38;/gi, "&")
      .replace(/&quot;|&#0*34;/gi, '"')
      .replace(/&#0*39;/gi, "'");
    let url: URL;
    try {
      url = upstreamUrl(instance, new URL(href, base).href);
    } catch {
      continue;
    }
    if (!/\/ilias\.php$/i.test(url.pathname)) continue;
    const baseClass = routing(url, "baseClass");
    const cmdClass = routing(url, "cmdClass");
    const cmd = routing(url, "cmd");
    const fallback = routing(url, "fallbackCmd");
    const page = routing(url, "page_number");
    if (
      baseClass === null ||
      cmdClass === null ||
      cmd === null ||
      fallback === null ||
      page === null
    )
      continue;
    if (
      baseClass !== "ilsearchcontroller" &&
      baseClass !== "ilsearchcontrollergui"
    )
      continue;
    if (cmdClass && cmdClass !== "ilsearchgui") continue;
    if (fallback && fallback !== "switchresultpage") continue;
    if (
      cmd !== "switchresultpage" &&
      !(cmd === "post" && fallback === "switchresultpage")
    )
      continue;
    if (!/^\d{1,3}$/.test(page)) continue;
    if (!links.has(Number(page))) links.set(Number(page), url.href);
  }
  return links;
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
  root?: string,
  signal?: AbortSignal,
): Promise<SearchResults> {
  if (root !== undefined && !validObjectId(root))
    throw new IliasError("That search location is invalid.", 400);
  // ILIAS stores one mutable search per session. Serialize queries and paging
  // separately from the cookie lock, which fetchUpstream may itself acquire.
  const previous = searchQueues.get(session.id);
  let release!: () => void;
  const queued = new Promise<void>((resolve) => { release = resolve; });
  searchQueues.set(session.id, queued);
  await previous;
  try {
    if (signal?.aborted) throw new IliasError("Search was cancelled.", 499);
    return await searchRepositoryUnlocked(session, query, pageNumber, root);
  } finally {
    release();
    if (searchQueues.get(session.id) === queued) searchQueues.delete(session.id);
  }
}

async function searchRepositoryUnlocked(
  session: Session,
  query: string,
  pageNumber: number,
  root?: string,
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
      last.root !== root ||
      Date.now() - last.at > searchFormTtl
    )
      throw new IliasError("That search expired. Start it again.", 409);
  }
  const form = await discoverSearchForm(session);
  let upstream: { response: Response; url: string };
  if (pageNumber > 1) {
    // ILIAS numbers its pages 0-based in the view control; page 2 is link 1.
    const target = lastSearches.get(session.id)?.links.get(pageNumber - 1);
    if (!target)
      throw new IliasError(
        "ILIAS did not offer that page. Start the search again.",
        409,
      );
    upstream = await fetchUpstream(session, target);
  } else {
    upstream = await submitSearch(session, form, query, root);
  }
  let results = await readSearchResults(upstream);
  const wrongSearch = (html: string) => {
    const term = echoedTerm(html);
    const location = echoedRoot(html);
    return (term !== null && term !== query) ||
      (location !== null && location !== (root || form.rootId));
  };
  if (wrongSearch(results.html)) {
    // ilCtrl falls back to the saved search when it ignores the token; never
    // pass that page off as this query's results.
    if (pageNumber > 1)
      throw new IliasError("That search expired. Start it again.", 409);
    clearSearchFormCache(session.id);
    upstream = await submitSearch(
      session,
      await discoverSearchForm(session),
      query,
      root,
    );
    results = await readSearchResults(upstream);
    if (wrongSearch(results.html))
      throw new IliasError("ILIAS returned a different search. Try again.", 409);
  }
  const page = parsePage(results.html, results.url);
  if (!page.authenticated)
    throw new IliasError(
      "Your ILIAS session has expired. Reconnect your account.",
      401,
    );
  const links = pagingLinks(results.html, session.instance, results.url);
  lastSearches.set(session.id, { query, root, at: Date.now(), links });
  return {
    results: page.items,
    sourceUrl: results.url,
    // The link for the next page is ILIAS' own; without it there is no page.
    hasMore: links.has(pageNumber) && pageNumber < maxSearchPage,
    page: pageNumber,
  };
}
