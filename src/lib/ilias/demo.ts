import type { IliasPage, Item } from "./types";
const base = "https://ilias.uni-freiburg.de/";
const item = (
  id: string,
  type: string,
  title: string,
  description = "",
  meta = "",
  context?: string,
): Item => ({
  id,
  type,
  title,
  description,
  meta,
  ...(context ? { context } : {}),
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
const demoGroups = [
  item(
    "601",
    "grp",
    "Gruppe 02",
    "Exercise group for the Algorithms course. Tuesdays, 14:00–16:00.",
    "Group · Example group",
    "Introduction to Computer Science › Exercise groups",
  ),
  item(
    "602",
    "grp",
    "Gruppe 02",
    "Exercise group for Linear Algebra. Wednesdays, 10:00–12:00.",
    "Group · Example group",
    "Linear Algebra I › Exercise groups",
  ),
  item(
    "603",
    "grp",
    "Gruppe 02",
    "Exercise group for HCI. Thursdays, 16:00–18:00.",
    "Group · Example group",
    "Human–Computer Interaction › Exercise groups",
  ),
];
/** Deep demo index: every course and its materials, with duplicate names in context. */
export function demoSearchItems() {
  const items = [...demoCourses];
  for (const course of demoCourses) {
    for (const material of demoPage("crs", course.id).items)
      items.push({
        ...material,
        id: `${course.id}${material.id}`,
        context: material.context || course.title,
      });
    for (const material of demoPage("fold", "201").items)
      items.push({
        ...material,
        id: `${course.id}9${material.id}`,
        context: `${course.title} › Lecture materials`,
      });
  }
  items.push(...demoGroups);
  return items;
}
export function demoPage(type?: string, id?: string): IliasPage {
  const course = demoCourses.find((c) => c.id === id);
  const group = type === "grp" ? demoGroups.find((g) => g.id === id) : undefined;
  const isFolder = type === "fold";
  return {
    title: group?.title || (isFolder
      ? "Lecture materials"
      : course?.title || "Your learning space"),
    description: group?.description || (isFolder
      ? "Slides and reading, all in one place."
      : course?.description ||
        "A little less searching. A little more learning."),
    sourceUrl: group?.sourceUrl || `${base}ilias.php?baseClass=ilDashboardGUI`,
    authenticated: true,
    userName: "Alex",
    hasMore: false,
    notices: [],
    tools:
      course || isFolder || group
        ? [
            { title: "Content", url: base },
            { title: "Members", url: base },
            { title: "Learning progress", url: base },
          ]
        : [],
    text: group
      ? [
          "This is an example exercise group. In a connected account, the group members and materials come from your ILIAS course.",
        ]
      : course
        ? [
            "Welcome to the course. Start with the lecture materials, then work through the weekly exercises.",
            "Office hours: Tuesdays, 14:00–15:00. Please use the course forum for questions about the material.",
          ]
        : [],
    items: group
      ? demoPage("fold", "201").items.map((material) => ({
          ...material,
          context: group.title,
        }))
      : isFolder
        ? [
            item(
              "301",
              "file",
              "01 — Getting started.pdf",
              "Lecture slides · Example PDF",
              "PDF · 1 page",
              "Lecture materials",
            ),
            item(
              "302",
              "file",
              "02 — Thinking in algorithms.pdf",
              "Lecture slides · Example PDF",
              "PDF · 1 page",
              "Lecture materials",
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
                course.title,
              ),
              item(
                "301",
                "file",
                "Course handbook.pdf",
                "Everything you need to get started.",
                "PDF · 1 page",
                course.title,
              ),
              item(
                "401",
                "exc",
                "Exercises / Übungen",
                "Übungseinheiten, Abgaben und Bewertungen.",
                "Übungseinheiten · Tutor workspace",
                course.title,
              ),
              item(
                "402",
                "frm",
                "Questions & discussion",
                "A place to ask, help, and learn together.",
                "",
                course.title,
              ),
              item(
                "403",
                "tst",
                "Check your understanding",
                "A short practice quiz after the first lecture.",
                "",
                course.title,
              ),
            ]
          : demoCourses,
  };
}
