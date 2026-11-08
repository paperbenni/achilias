/** Keep post-login navigation on this origin, including query strings. */
export function safeReturnTo(value?: unknown) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return "/";
  // Normalize dot segments before returning a path to window.location.
  const url = new URL(value, "http://achilias.local");
  if (url.pathname.startsWith("//")) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

/** File links are also API endpoints: only browser navigations get a login UI. */
export function fileSignInRequired(request: Request, message: string) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  const mode = request.headers.get("sec-fetch-mode");
  const navigation = mode
    ? mode === "navigate"
    : request.headers.get("accept")?.includes("text/html");
  if (!navigation)
    return Response.json({ error: message }, { status: 401, headers });
  const target = new URL(request.url);
  const login = new URL("/login", target);
  login.searchParams.set("returnTo", `${target.pathname}${target.search}`);
  // Stay on the browser's host even when Next.js uses an internal server URL.
  headers.set("Location", `${login.pathname}${login.search}`);
  return new Response(null, { status: 307, headers });
}
