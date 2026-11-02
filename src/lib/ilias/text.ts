/** Collapse ILIAS whitespace runs into single spaces and trim the ends. */
export function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
