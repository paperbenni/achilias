import { expect, test } from "bun:test";
import { load } from "cheerio";
import { formFields } from "../src/lib/ilias/html-forms";

test("formFields includes the first named submitter only when requested", () => {
  const $ = load(
    `<form id="target">
      <input name="field" value="value">
      <input type="submit" name="yt0" value="Login">
      <button name="delete">Delete</button>
    </form>`,
  );
  expect(formFields($, $("#target"))).toEqual([["field", "value"]]);
  expect(formFields($, $("#target"), { submitter: true })).toEqual([
    ["field", "value"],
    ["yt0", "Login"],
  ]);
});

test("formFields uses a button's text when it has no value", () => {
  const $ = load(`<form id="target"><button name="save">Save changes</button></form>`);
  expect(formFields($, $("#target"), { submitter: true })).toEqual([
    ["save", "Save changes"],
  ]);
});
