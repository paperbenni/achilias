import type { CheerioAPI } from "cheerio";

/** Development reference, not a claim of verified instance compatibility. */
export const ILIAS_REFERENCE_MAJOR = 10;
export const ILIAS_REFERENCE_REVISION = "d8dd98bc6cd09446465b2999199594f574babab3";

export function readIliasVersion($: CheerioAPI): string | undefined {
  // Read only the standard footer, never arbitrary course text or asset hashes.
  const footer = $("footer, #ilFooter, .il-footer, .il-maincontrols-footer").text();
  return footer.match(
    /\bILIAS\s*\(\s*v?(\d{1,3}\.\d{1,3}(?:\.\d{1,3})?(?:[_. -]?(?:alpha|beta|rc|dev|snapshot|trunk)[a-z0-9.-]*)?)(?=[\s)])/i,
  )?.[1];
}

export function iliasCompatibility(version?: string) {
  if (!version) return "unknown";
  return /^\d+\.\d+(?:\.\d+)?$/.test(version) &&
    Number(version.split(".")[0]) === ILIAS_REFERENCE_MAJOR
    ? "reference"
    : "unverified";
}
