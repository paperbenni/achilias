import { validObjectId } from "./identifiers";
import { IliasError } from "./errors";
import type { Session } from "./session";

/** The user's browser preference is resolved server-side for every request.
 * It controls Achilias features; ILIAS still enforces the account's permissions.
 */
export function liveWriteAllowed(
  session: Session | null,
  kind: "exc" | "frm",
  id: string,
) {
  return !!session && session.readOnly === false &&
    (kind === "exc" || kind === "frm") && validObjectId(id);
}
export function requireLiveWrite(session: Session, kind: "exc" | "frm", id: string) {
  if (!liveWriteAllowed(session, kind, id))
    throw new IliasError(
      "Live changes are disabled by your read-only preference. Turn off Read-only mode in Features & connection to make changes here.",
      403,
    );
}
