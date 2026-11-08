import { describe, expect, test } from "bun:test";
import { parentCrumb, workspaceCrumbs } from "../src/lib/ilias/breadcrumbs";
import type { IliasPage } from "../src/lib/ilias/types";
import { parsePage } from "../src/lib/ilias/parser";

const page = (overrides: Partial<IliasPage> = {}): IliasPage => ({
  title: "Lecture materials",
  description: "",
  items: [],
  tools: [],
  text: [],
  notices: [],
  sourceUrl: "https://ilias.example/ilias.php",
  authenticated: true,
  userName: "",
  hasMore: false,
  ...overrides,
});

describe("workspace breadcrumbs", () => {
  test("reads the live ILIAS RTL trail in root-to-page order", () => {
    const parsed = parsePage(
      `<h1>Open WebUI Support-Forum</h1>
      <nav class="il-header-locator"><div class="dropdown">
        <button>Open WebUI Support-Forum</button>
        <ul><li><button data-action="goto.php/crs/101">Open WebUI Support- und Info-Bereich</button></li></ul>
      </div></nav>
      <div class="breadcrumbs"><nav aria-label="Brotkrumen" class="breadcrumb-wrapper">
        <div class="breadcrumb" dir="rtl">
          <span class="breadcrumb-crumb" dir="ltr"><a href="ilias.php?cmdClass=ilObjForumGUI&amp;ref_id=201">Open WebUI Support-Forum</a></span>
          <span class="breadcrumb-separator" dir="rtl"></span>
          <span class="breadcrumb-crumb" dir="ltr"><a href="goto.php/crs/101">Open WebUI Support- und Info-Bereich</a></span>
          <span class="breadcrumb-separator" dir="rtl"></span>
          <span class="breadcrumb-crumb" dir="ltr"><a href="goto.php/root/1">Magazin</a></span>
        </div>
      </nav></div>`,
      "https://ilias.example/ilias.php?ref_id=201",
    );
    const crumbs = workspaceCrumbs(parsed, false);
    expect(crumbs).toEqual([
      { title: "My courses", href: "/courses" },
      { title: "Open WebUI Support- und Info-Bereich", href: "/browse/crs/101" },
      { title: "Open WebUI Support-Forum" },
    ]);
    expect(parentCrumb(crumbs)?.href).toBe("/browse/crs/101");
  });

  test("keeps nested folders in order with the newer LTR markup", () => {
    const parsed = parsePage(
      `<h1>Aufzeichnungen</h1><nav class="breadcrumb-wrapper"><div class="breadcrumb" dir="ltr">
        <span class="breadcrumb-crumb"><a href="goto.php/crs/101">Algorithms</a></span>
        <span class="breadcrumb-crumb"><a href="goto.php/fold/200">Lecture materials</a></span>
        <span class="breadcrumb-crumb">Aufzeichnungen</span>
      </div></nav>`,
      "https://ilias.example/ilias.php?ref_id=201",
    );
    expect(workspaceCrumbs(parsed, false)).toEqual([
      { title: "My courses", href: "/courses" },
      { title: "Algorithms", href: "/browse/crs/101" },
      { title: "Lecture materials", href: "/browse/fold/200" },
      { title: "Aufzeichnungen" },
    ]);
  });

  test("preserves the course and nested folder path from the legacy ILIAS locator", () => {
    const parsed = parsePage(
      `<h1>Aufzeichnungen</h1>
      <ol class="breadcrumb hidden-print">
        <li><a href="goto.php?target=root_1">Magazin</a></li>
        <li><a href="goto.php?target=crs_101">Algorithms</a></li>
        <li><a href="goto.php?target=fold_200">Lecture materials</a></li>
        <li><a href="goto.php?target=fold_201">Aufzeichnungen</a></li>
      </ol>`,
      "https://ilias.example/ilias.php?ref_id=201",
    );
    const crumbs = workspaceCrumbs(parsed, false);
    expect(crumbs).toEqual([
      { title: "My courses", href: "/courses" },
      { title: "Algorithms", href: "/browse/crs/101" },
      { title: "Lecture materials", href: "/browse/fold/200" },
      { title: "Aufzeichnungen", href: "/browse/fold/201" },
    ]);
    expect(parentCrumb(crumbs)?.href).toBe("/browse/fold/200");
  });

  test("handles a legacy locator with an unlinked current folder in demo mode", () => {
    const parsed = parsePage(
      `<h1>Aufzeichnungen</h1><ol class="breadcrumb">
        <li><a href="go/crs/101">Algorithms</a></li>
        <li>Aufzeichnungen</li>
      </ol>`,
      "https://ilias.example/ilias.php?ref_id=201",
    );
    const crumbs = workspaceCrumbs(parsed, true);
    expect(crumbs).toEqual([
      { title: "My courses", href: "/courses?demo=1" },
      { title: "Algorithms", href: "/browse/crs/101?demo=1" },
      { title: "Aufzeichnungen" },
    ]);
    expect(parentCrumb(crumbs)?.href).toBe("/browse/crs/101?demo=1");
  });

  test("prefers the modern trail and ignores hidden legacy locators", () => {
    const parsed = parsePage(
      `<h1>Aufzeichnungen</h1>
      <nav class="breadcrumb_wrapper"><div class="breadcrumb">
        <span class="crumb"><a href="go/crs/101">Algorithms</a></span>
      </div></nav>
      <ol class="breadcrumb"><li><a href="go/crs/101">Algorithms</a></li></ol>
      <dialog><ol class="breadcrumb"><li>Unrelated course</li></ol></dialog>`,
      "https://ilias.example/ilias.php?ref_id=201",
    );
    expect(workspaceCrumbs(parsed, false)).toEqual([
      { title: "My courses", href: "/courses" },
      { title: "Algorithms", href: "/browse/crs/101" },
      { title: "Aufzeichnungen" },
    ]);
    const hidden = parsePage(
      `<h1>Aufzeichnungen</h1><dialog><ol class="breadcrumb"><li>Unrelated course</li></ol></dialog>`,
      "https://ilias.example/ilias.php?ref_id=201",
    );
    expect(hidden.breadcrumbs).toEqual([]);
  });

  test("maps the ILIAS root to My courses and keeps ancestor links", () => {
    const crumbs = workspaceCrumbs(
      page({
        breadcrumbs: [
          { title: "Repository", type: "root", id: "1" },
          {
            title: "Introduction to Computer Science",
            type: "crs",
            id: "101",
          },
          { title: "Lecture materials", type: "fold", id: "201" },
        ],
      }),
      false,
    );
    expect(crumbs).toEqual([
      { title: "My courses", href: "/courses" },
      {
        title: "Introduction to Computer Science",
        href: "/browse/crs/101",
      },
      { title: "Lecture materials", href: "/browse/fold/201" },
    ]);
    expect(parentCrumb(crumbs)).toEqual({
      title: "Introduction to Computer Science",
      href: "/browse/crs/101",
    });
  });

  test("adds the current thread when ILIAS stops at the forum", () => {
    const crumbs = workspaceCrumbs(
      page({
        title: "Why does binary search need a sorted array?",
        breadcrumbs: [
          { title: "Repository", type: "root", id: "1" },
          {
            title: "Introduction to Computer Science",
            type: "crs",
            id: "101",
          },
          { title: "Questions & discussion", type: "frm", id: "402" },
        ],
      }),
      false,
    );
    expect(crumbs).toEqual([
      { title: "My courses", href: "/courses" },
      {
        title: "Introduction to Computer Science",
        href: "/browse/crs/101",
      },
      { title: "Questions & discussion", href: "/forums/402" },
      { title: "Why does binary search need a sorted array?" },
    ]);
    expect(parentCrumb(crumbs)).toEqual({
      title: "Questions & discussion",
      href: "/forums/402",
    });
  });

  test("falls back to My courses and the page title when ILIAS has no path", () => {
    const crumbs = workspaceCrumbs(
      page({ title: "Questions & discussion" }),
      true,
    );
    expect(crumbs).toEqual([
      { title: "My courses", href: "/courses?demo=1" },
      { title: "Questions & discussion" },
    ]);
    expect(parentCrumb(crumbs)).toEqual({
      title: "My courses",
      href: "/courses?demo=1",
    });
  });
});
