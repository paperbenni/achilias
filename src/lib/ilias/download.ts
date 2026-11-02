import { IliasError } from "./client";
export function downloadHeaders() {
  return new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
}
export async function downloadResponse(
  response: Response,
  fallbackName: string,
) {
  const headers = downloadHeaders();
  const type =
    response.headers.get("content-type") || "application/octet-stream";
  const original = response.headers.get("content-disposition");
  if (
    /text\/html|application\/json/i.test(type) &&
    !/attachment/i.test(original || "")
  ) {
    await response.body?.cancel();
    throw new IliasError(
      "ILIAS returned a sign-in or information page instead of a file. Reconnect or check the original page.",
      401,
    );
  }
  headers.set("Content-Type", type);
  headers.set(
    "Content-Disposition",
    original?.match(/filename\*?=/i)
      ? original.replace(/^inline/i, "attachment")
      : `attachment; filename="${fallbackName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
  );
  return new Response(response.body, { headers });
}
