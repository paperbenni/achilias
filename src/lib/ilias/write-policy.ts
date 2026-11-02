import { objectUrl } from "./config";
import { validObjectId } from "./identifiers";
import { IliasError } from "./errors";

/** Deliberately evaluated per request, shared by UI state and every mutation. */
export function liveWriteAllowed(
  instance: string,
  kind: "exc" | "frm",
  id: string,
) {
  if (!validObjectId(id)) return false;
  const expected = objectUrl(instance, kind, id);
  return (process.env.ACHILIAS_WRITE_TARGETS || "").split(",").some((entry) => {
    try {
      const url = new URL(entry.trim());
      // Require the exact canonical object URL; no wildcards or cross-instance IDs.
      return url.href === expected;
    } catch {
      return false;
    }
  });
}
export function requireLiveWrite(
  instance: string,
  kind: "exc" | "frm",
  id: string,
) {
  if (!liveWriteAllowed(instance, kind, id))
    throw new IliasError(
      "Live changes are disabled for this object. Ask the server administrator to enable editing for this object. Use the original ILIAS interface to make changes.",
      403,
    );
}
