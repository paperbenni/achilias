import { chromium } from "playwright";
import { load } from "cheerio";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { formFields } from "../src/lib/ilias/html-forms";
const html = await readFile(
  new URL("../tests/fixtures/form-controls.html", import.meta.url),
  "utf8",
);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html);
  const expected = await page.evaluate(() =>
    [
      ...new FormData(document.querySelector<HTMLFormElement>("#target")!),
    ].filter(([, value]) => typeof value === "string"),
  );
  const $ = load(html);
  assert.deepEqual(formFields($, $("#target")), expected);
  console.log(
    "Passed: static ILIAS form serialization matches Chromium for disabled controls, fieldset legends, selected/default options, external form owners, duplicate names, textareas and omitted uploads/submitters.",
  );
} finally {
  await browser.close();
}
