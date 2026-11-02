import { validObjectId } from "./identifiers";

/** An explicit ILIAS file controller identifies a file, not its MIME format.
 * Match exactly: exercise submission/file-management controllers are different
 * objects, and their ref_id must never be treated as a repository file ID. */
export function fileControllerReference(value: string | URL) {
  try {
    const url = value instanceof URL ? value : new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !url.pathname.endsWith("/ilias.php")
    )
      return;
    const params = url.searchParams;
    if (
      params.getAll("cmdClass").length !== 1 ||
      params.getAll("ref_id").length !== 1 ||
      params.get("cmdClass")?.toLowerCase() !== "ilobjfilegui"
    )
      return;
    const id = params.get("ref_id") || "";
    return validObjectId(id) ? id : undefined;
  } catch {
    return;
  }
}
