import type { IliasPage, Item } from "./types";
const base = "https://ilias.uni-freiburg.de/";
const item = (
  id: string,
  type: string,
  title: string,
  description = "",
  meta = "",
): Item => ({
  id,
  type,
  title,
  description,
  meta,
  available: true,
  sourceUrl: `${base}goto.php?target=${type}_${id}`,
});
export const demoCourses = [
  item(
    "101",
    "crs",
    "Introduction to Computer Science",
    "Algorithms, data structures, and the art of solving problems.",
    "Winter semester · Example course",
  ),
  item(
    "102",
    "crs",
    "Linear Algebra I",
    "Vectors, matrices, and the structures behind them.",
    "Winter semester · Example course",
  ),
  item(
    "103",
    "crs",
    "Human–Computer Interaction",
    "Understanding people. Designing better interactions.",
    "Winter semester · Example course",
  ),
  item(
    "104",
    "crs",
    "Foundations of Mathematics",
    "Logic, proofs, and a language for clear thinking.",
    "Winter semester · Example course",
  ),
];
export function demoPage(type?: string, id?: string): IliasPage {
  const course = demoCourses.find((c) => c.id === id);
  const isFolder = type === "fold";
  return {
    title: isFolder
      ? "Lecture materials"
      : course?.title || "Your learning space",
    description: isFolder
      ? "Slides and reading, all in one place."
      : course?.description ||
        "A little less searching. A little more learning.",
    sourceUrl: `${base}ilias.php?baseClass=ilDashboardGUI`,
    authenticated: true,
    userName: "Alex",
    hasMore: false,
    notices: [],
    tools:
      course || isFolder
        ? [
            { title: "Content", url: base },
            { title: "Members", url: base },
            { title: "Learning progress", url: base },
          ]
        : [],
    text: course
      ? [
          "Welcome to the course. Start with the lecture materials, then work through the weekly exercises.",
          "Office hours: Tuesdays, 14:00–15:00. Please use the course forum for questions about the material.",
        ]
      : [],
    items: isFolder
      ? [
          item(
            "301",
            "file",
            "01 — Getting started.pdf",
            "Lecture slides · Example PDF",
            "PDF · 1 page",
          ),
          item(
            "302",
            "file",
            "02 — Thinking in algorithms.pdf",
            "Lecture slides · Example PDF",
            "PDF · 1 page",
          ),
        ]
      : course
        ? [
            item(
              "201",
              "fold",
              "Lecture materials",
              "Slides and reading for every lecture.",
              "2 example files",
            ),
            item(
              "301",
              "file",
              "Course handbook.pdf",
              "Everything you need to get started.",
              "PDF · 1 page",
            ),
            item(
              "401",
              "exc",
              "Exercises / Übungen",
              "Übungseinheiten, Abgaben und Bewertungen.",
              "Übungseinheiten · Tutor workspace",
            ),
            item(
              "402",
              "frm",
              "Questions & discussion",
              "A place to ask, help, and learn together.",
            ),
            item(
              "403",
              "tst",
              "Check your understanding",
              "A short practice quiz after the first lecture.",
            ),
          ]
        : demoCourses,
  };
}
