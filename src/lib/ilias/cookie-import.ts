import { CookieJar } from "tough-cookie";
export async function importInstanceCookies(data: unknown, instance: string) {
  const values = Array.isArray(data)
    ? data
    : data && typeof data === "object" && "cookies" in data
      ? data.cookies
      : undefined;
  if (!Array.isArray(values) || values.length > 1000)
    throw new Error(
      "Expected an exported cookie array or Playwright storageState.",
    );
  const jar = new CookieJar();
  const hostname = new URL(instance).hostname;
  let count = 0;
  for (const cookie of values) {
    if (!cookie || typeof cookie !== "object")
      throw new Error("Invalid cookie data.");
    if (
      typeof cookie.domain !== "string" ||
      cookie.domain.replace(/^\./, "") !== hostname
    )
      continue;
    if (
      typeof cookie.name !== "string" ||
      typeof cookie.value !== "string" ||
      !cookie.name ||
      /[;\r\n=\s]/.test(cookie.name) ||
      /[;\r\n]/.test(cookie.value)
    )
      throw new Error("Invalid cookie data.");
    const path = typeof cookie.path === "string" ? cookie.path : "/";
    if (!path.startsWith("/") || /[;\r\n]/.test(path))
      throw new Error("Invalid cookie path.");
    await jar.setCookie(
      `${cookie.name}=${cookie.value}; Path=${path}${cookie.secure ? "; Secure" : ""}${cookie.httpOnly ? "; HttpOnly" : ""}${typeof cookie.expires === "number" && cookie.expires > 0 ? `; Expires=${new Date(cookie.expires * 1000).toUTCString()}` : ""}`,
      instance,
    );
    count++;
  }
  if (!count)
    throw new Error("No cookies for this ILIAS instance were provided.");
  return jar.serializeSync();
}
