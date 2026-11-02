import { load } from "cheerio";
import { upstreamUrl } from "./config";
import type { Session } from "./session";

export type SearchForm = {
  instance: string; action: string; rootId: string; fields: [string, string][];
};
export const searchFormTtl = 5 * 60_000;
const forms = new Map<string, { form: SearchForm; expiresAt: number }>();
export function cachedSearchForm(session: Session) {
  const entry = forms.get(session.id);
  return entry?.form.instance === session.instance && entry.expiresAt > Date.now() ? entry.form : undefined;
}
export function clearCachedSearchForms(sessionId?: string) {
  if (sessionId === undefined) forms.clear();
  else forms.delete(sessionId);
}
/** Capture the main-menu form during ordinary authenticated loads, avoiding a
 * second dashboard fetch just to discover its action. Tokens stay in memory. */
export function observeSearchForm(session: Session, html: string, url: string) {
  if (cachedSearchForm(session)) return;
  const $ = load(html);
  const form = $("#mm_search_form").first();
  const action = form.attr("action") || "";
  if (!form.length || !action) return;
  let actionUrl: URL;
  try {
    actionUrl = upstreamUrl(
      session.instance,
      new URL(action, url).href,
    );
  } catch {
    return;
  }
  const fields: [string, string][] = [];
  form.find('input[type="hidden"][name]').each((_, node) => {
    const name = $(node).attr("name");
    const value = $(node).attr("value");
    if (name && value !== undefined && !fields.some(([key]) => key === name))
      fields.push([name, value]);
  });
  const root = form.find('input[name="root_id"]').first().attr("value") || "";
  forms.delete(session.id);
  forms.set(session.id, { form: {
    instance: session.instance, action: actionUrl.href,
    rootId: /^[1-9]\d{0,11}$/.test(root) ? root : "1", fields,
  }, expiresAt: Date.now() + searchFormTtl });
  while (forms.size > 200) forms.delete(forms.keys().next().value!);
}
