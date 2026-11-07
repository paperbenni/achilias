import { describe, expect, test } from "bun:test";
import { parentCrumb, workspaceCrumbs } from "../src/lib/ilias/breadcrumbs";
import type { IliasPage } from "../src/lib/ilias/types";

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
