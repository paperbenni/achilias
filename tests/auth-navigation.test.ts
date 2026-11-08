import { expect, test } from "bun:test";
import { fileSignInRequired, safeReturnTo } from "../src/lib/auth-navigation";

test("file navigations prompt for login and retain the complete destination", () => {
  const cases: HeadersInit[] = [
    { "sec-fetch-mode": "navigate" },
    { accept: "text/html,application/xhtml+xml" },
  ];
  for (const headers of cases) {
    const request = new Request("http://localhost:3000/api/files/4395707?view=1", {
      headers,
    });
    const response = fileSignInRequired(request, "Session expired.");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toStartWith("/login?");
    const login = new URL(response.headers.get("location")!, request.url);
    expect(login.pathname).toBe("/login");
    expect(login.searchParams.get("returnTo")).toBe("/api/files/4395707?view=1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  }
});

test("API consumers receive a 401 instead of login HTML", async () => {
  const cases: HeadersInit[] = [
    {},
    { accept: "application/json" },
    { "sec-fetch-mode": "cors", accept: "text/html" },
  ];
  for (const headers of cases) {
    const response = fileSignInRequired(
      new Request("http://localhost/api/files/1", { headers }),
      "Session expired.",
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Session expired." });
    expect(response.headers.has("location")).toBe(false);
  }
});

test("login return paths cannot leave Achilias, including after URL normalization", () => {
  expect(safeReturnTo("/api/files/4395707?view=1#page=4")).toBe(
    "/api/files/4395707?view=1#page=4",
  );
  for (const value of [
    undefined, ["/courses", "//evil.test"], "https://evil.test", "//evil.test",
    "/\\evil.test", "/\n/evil.test", "/a/..//evil.test", "/%2e%2e//evil.test",
    "javascript:alert(1)",
  ])
    expect(safeReturnTo(value)).toBe("/");
});
