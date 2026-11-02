import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { ItemAction } from "../src/components/navigation/item-action";
import { expect, test } from "bun:test";
import { fileControllerReference } from "../src/lib/ilias/file-reference";
import { parsePage } from "../src/lib/ilias/parser";
import { decodeLibrary, mergeItems } from "../src/lib/ilias/library";
import { itemOpenHref, isFileItem } from "../src/lib/ilias/items";
import type { Item } from "../src/lib/ilias/types";
const supplied =
  "https://ilias.uni-freiburg.de/ilias.php?baseClass=ilrepositorygui&cmdNode=102:p8&cmdClass=ilObjFileGUI&cmd=sendfile&ref_id=4386596";
const row = (href: string, extra = "") =>
  `<div class="ilContainerListItemOuter" id="lg_div_4386596">${extra}<h3><a class="il_ContainerItemTitle" href="${href.replaceAll("&", "&amp;")}">Lecture document</a></h3></div>`;
test("the supplied Freiburg URL classifies as a file without an icon or filename extension", () => {
  const item = parsePage(
    row(supplied),
    "https://ilias.uni-freiburg.de/ilias.php",
  ).items[0];
  expect(item.type).toBe("file");
  expect(item.id).toBe("4386596");
  expect(isFileItem(item)).toBe(true);
  expect(itemOpenHref(item)).toBe("/api/files/4386596?view=1");
  // The explicit controller wins over an unknown or format-specific icon.
  expect(
    parsePage(
      row(supplied, '<img class="ilListItemIcon" src="icon_pdf.svg">'),
      "https://ilias.uni-freiburg.de/",
    ).items[0].type,
  ).toBe("file");
});
test("file-controller recognition does not guess from titles, commands or other file-related controllers", () => {
  expect(fileControllerReference(supplied)).toBe("4386596");
  expect(
    fileControllerReference(supplied.replace("ilObjFileGUI", "ILOBJFILEGUI")),
  ).toBe("4386596");
  for (const url of [
    supplied + "&ref_id=123",
    supplied + "&cmdClass=ilObjExerciseGUI",
    supplied.replace("4386596", "0"),
    supplied.replace("ilObjFileGUI", "ilExSubmissionFileGUI"),
    supplied.replace("ilObjFileGUI", "ilObjExerciseGUI"),
    supplied.replace("https:", "http:"),
    supplied.replace("ilias.php", "other.php"),
  ])
    expect(fileControllerReference(url)).toBeUndefined();
  expect(
    parsePage(
      row(supplied.replace("ilObjFileGUI", "ilObjExerciseGUI")),
      "https://ilias.uni-freiburg.de/",
    ).items[0].type,
  ).toBe("unknown");
});
test("legacy bookmarks and recent entries upgrade and deduplicate without changing their metadata", () => {
  const old: Item = {
    id: "4386596",
    type: "unknown",
    title: "Lecture document",
    description: "Saved description",
    meta: "",
    sourceUrl: supplied,
    available: true,
    context: "Course › Week 1",
  };
  const saved = decodeLibrary({ saved: [old], recent: [old] });
  expect(saved.saved[0].type).toBe("file");
  expect(saved.recent[0].type).toBe("file");
  expect(saved.saved[0].context).toBe(old.context);
  expect(
    mergeItems([{ ...old, type: "file", title: "Current title" }], saved.saved),
  ).toHaveLength(1);
  expect(
    mergeItems(
      [{ ...old, type: "file", title: "Current title" }],
      saved.saved,
    )[0].title,
  ).toBe("Current title");
  expect(decodeLibrary({ saved: [{ ...old, id: "999" }] }).saved[0].type).toBe(
    "unknown",
  );
});

test("the second supplied URL renders a proxy link on the actual file button", () => {
  const url =
    "https://ilias.uni-freiburg.de/ilias.php?baseClass=ilrepositorygui&cmdNode=102:p8&cmdClass=ilObjFileGUI&cmd=sendfile&ref_id=4394217";
  for (const icon of ["", '<img class="ilListItemIcon" src="icon_webr.svg">']) {
    const item = parsePage(
      row(url, icon),
      "https://ilias.uni-freiburg.de/ilias.php",
    ).items[0];
    expect(item.type).toBe("file");
    expect(item.id).toBe("4394217");
    const html = renderToStaticMarkup(
      createElement(ItemAction, {
        item,
        demo: false,
        onOpen: () => {},
        onVisit: () => {},
        children: "Lecture document",
      }),
    );
    const $ = load(html);
    expect($("a").attr("href")).toBe("/api/files/4394217?view=1");
    expect($("a").attr("target")).toBe("_blank");
    expect($("button").length).toBe(0);
  }
});
