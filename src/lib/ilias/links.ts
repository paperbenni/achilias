import { upstreamUrl } from "./config";

/**
 * Resolve a link found in parsed ILIAS HTML to a same-installation HTTPS URL,
 * or undefined for fragments, unsafe schemes, and anything that would leave
 * the ILIAS instance. Parsed markup is never trusted for navigation.
 */
export function upstreamLink(href: string, sourceUrl: string) {
  try {
    if (!href.trim() || href.startsWith("#")) return undefined;
    const source = new URL(sourceUrl);
    const url = upstreamUrl(
      new URL("./", source).href,
      new URL(href, source).href,
    );
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
