import { create, parse } from "content-disposition";
/** RFC 6266 / RFC 8187 parsing is shared by the proxy and browser downloads. */
export function fileName(header: string | null, fallback: string) {
  let name: string | undefined;
  try {
    name = header ? parse(header).parameters.filename : undefined;
  } catch {
    /* Use the safe fallback for malformed upstream headers. */
  }
  const safe = (value: string) =>
    value
      .split(/[\\/]/)
      .at(-1)
      ?.replace(/[\x00-\x1f\x7f]/g, "")
      .trim();
  const candidate = safe(name || "");
  return candidate && candidate !== "." && candidate !== ".."
    ? candidate
    : safe(fallback) || "download";
}
export function fileDisposition(
  header: string | null,
  fallback: string,
  inline = false,
) {
  return create(fileName(header, fallback), {
    type: inline ? "inline" : "attachment",
  });
}
export function isAttachment(header: string | null) {
  try {
    return !!header && parse(header).type === "attachment";
  } catch {
    return false;
  }
}
