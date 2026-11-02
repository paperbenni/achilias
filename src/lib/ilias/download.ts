import { fileDisposition, isAttachment } from "../file-disposition";
import { peekPdf } from "./pdf-stream";
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
  options: { inlinePdf?: boolean } = {},
) {
  const headers = downloadHeaders();
  const type =
    response.headers.get("content-type") || "application/octet-stream";
  const original = response.headers.get("content-disposition");
  if (/text\/html|application\/json/i.test(type) && !isAttachment(original)) {
    await response.body?.cancel();
    throw new IliasError(
      "ILIAS returned a sign-in or information page instead of a file. Reconnect or check the original page.",
      401,
    );
  }
  const { body, pdf } = options.inlinePdf
    ? await peekPdf(response.body)
    : { body: response.body, pdf: false };
  // CSP sandbox disables native PDF viewers. Only a verified PDF may omit it;
  // all other uploaded content stays a sandboxed attachment with nosniff.
  if (pdf) headers.set("Content-Security-Policy", "default-src 'none'");
  headers.set("Content-Type", pdf ? "application/pdf" : type);
  headers.set(
    "Content-Disposition",
    fileDisposition(original, pdf ? `${fallbackName}.pdf` : fallbackName, pdf),
  );
  return new Response(body, { headers });
}
