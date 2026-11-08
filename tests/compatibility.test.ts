import { expect, test } from "bun:test";
import { parsePage } from "../src/lib/ilias/parser";
import { iliasCompatibility } from "../src/lib/ilias/compatibility";
import { runWithIsolatedSessions } from "./helpers/isolated-sessions";

const parse = (html: string) => parsePage(html, "https://ilias.example.edu/ilias.php");

test("versions come from standard footers, including dated releases and prereleases", () => {
  for (const [html, expected] of [
    ["<footer>powered by ILIAS (v10.6 2026-01-01)</footer>", "10.6"],
    ['<div id="ilFooter">powered by ILIAS (v9.13)</div>', "9.13"],
    ['<div class="il-maincontrols-footer">powered by ILIAS (v11.0.1)</div>', "11.0.1"],
    ['<div class="il-footer">powered by ILIAS (v10.0_beta1)</div>', "10.0_beta1"],
  ])
    expect(parse(html).iliasVersion).toBe(expected);
});

test("course text, scripts, asset versions and malformed footers do not identify the server", () => {
  for (const html of [
    "<h1>ILIAS (v11.0)</h1>",
    '<script src="ilias.js?version=11.0"></script>',
    '<footer><script>"ILIAS (v11.0)"</script></footer>',
    "<footer>ILIAS (v11.invalid)</footer>",
    "<footer>ILIAS (v10.0.1.2)</footer>",
    "<footer>powered by ILIAS</footer>",
  ])
    expect(parse(html).iliasVersion).toBeUndefined();
});

test("the development reference is distinct from unverified and unknown versions", () => {
  expect(iliasCompatibility("10.6")).toBe("reference");
  expect(iliasCompatibility("10.6.1")).toBe("reference");
  for (const version of ["9.13", "11.0", "10.0_beta1", "10.0-dev", "invalid"])
    expect(iliasCompatibility(version)).toBe("unverified");
  expect(iliasCompatibility()).toBe("unknown");
});

test("observed versions persist without extra fetches, overwriting cookies, or reviving logout", async () => {
  await runWithIsolatedSessions("tests/helpers/compatibility-session.ts");
});
