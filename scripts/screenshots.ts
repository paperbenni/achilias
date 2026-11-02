import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

const origin = process.env.ACHILIAS_SCREENSHOT_URL || "http://127.0.0.1:3000";
const output = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  type Scene = {
    file: string;
    path: string;
    heading: string;
    mobile?: boolean;
    dialog?: boolean;
    setup?: (page: Page) => Promise<void>;
    prepare?: (page: Page) => Promise<void>;
  };
  const scenes: Scene[] = [
    {
      file: "welcome.png",
      path: "/",
      heading: "Less friction. More learning.",
    },
    { file: "overview.png", path: "/?demo=1", heading: "Overview" },
    {
      file: "course.png",
      path: "/browse/crs/101?demo=1",
      heading: "Introduction to Computer Science",
    },
    {
      file: "forum.png",
      path: "/forums/402?demo=1",
      heading: "Questions & discussion",
    },
    {
      file: "thread.png",
      path: "/forums/402/threads/902?demo=1",
      heading: "Why does binary search need a sorted array?",
    },
    {
      file: "forum-unread.png",
      path: "/forums/402?demo=1",
      heading: "Questions & discussion",
      prepare: async (page) => {
        await page
          .getByRole("radio", { name: "Unread 2", exact: true })
          .click();
        await page
          .getByRole("link", {
            name: /Why does binary search need a sorted array/,
          })
          .waitFor();
      },
    },
    {
      file: "saved.png",
      path: "/saved?demo=1",
      heading: "Bookmarks.",
      setup: async (page) => {
        await page.goto(new URL("/browse/crs/101?demo=1", origin).href);
        for (const title of [
          "Lecture materials",
          "Course handbook.pdf",
          "Questions & discussion",
        ]) {
          await page
            .getByRole("button", { name: `Save ${title}`, exact: true })
            .click();
        }
      },
      prepare: async (page) => {
        await page
          .getByRole("link", { name: "Questions & discussion", exact: true })
          .waitFor();
      },
    },
    {
      file: "settings.png",
      path: "/settings?demo=1",
      heading: "A clear view of what’s here.",
    },
    {
      file: "connection.png",
      path: "/",
      heading: "Less friction. More learning.",
      dialog: true,
      prepare: async (page) => {
        await page
          .getByRole("button", { name: "Connect your ILIAS", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Get a connection code", exact: true })
          .waitFor();
        // Capture the setup before generating any session or secret connection code.
      },
    },
    {
      file: "exercises.png",
      path: "/exercises/401?demo=1",
      heading: "Algorithms — Übungen",
    },
    {
      file: "submissions.png",
      path: "/exercises/401/units/501?demo=1",
      heading: "Übung 01 — Algorithms",
    },
    {
      file: "assessment.png",
      path: "/exercises/401/units/501?demo=1",
      heading: "Übung 01 — Algorithms",
      dialog: true,
      prepare: async (page) => {
        await page
          .getByRole("list", { name: "Participant submissions" })
          .getByRole("listitem")
          .filter({ hasText: "Maya Chen" })
          .getByRole("button", { name: "Assess", exact: true })
          .click();
        await page
          .getByRole("textbox", {
            name: "Mark or points / Note oder Punkte",
            exact: true,
          })
          .fill("9 / 10");
        await page
          .getByRole("textbox", {
            name: "Private tutor note / Interne Notiz",
            exact: true,
          })
          .fill("Discuss task 3 in the tutorial.");
      },
    },
    {
      file: "unit-settings.png",
      path: "/exercises/401/units/501?demo=1",
      heading: "Übung 01 — Algorithms",
      prepare: async (page) => {
        await page
          .getByRole("tab", { name: "Unit settings", exact: true })
          .click();
        await page
          .getByRole("textbox", { name: "Title / Titel", exact: true })
          .waitFor();
      },
    },
    {
      file: "mobile-submissions.png",
      path: "/exercises/401/units/502?demo=1",
      heading: "Übung 02 — Recursion",
      mobile: true,
    },
    {
      file: "mobile-course.png",
      path: "/browse/crs/101?demo=1",
      heading: "Introduction to Computer Science",
      mobile: true,
    },
    {
      file: "mobile-forum.png",
      path: "/forums/402?demo=1",
      heading: "Questions & discussion",
      mobile: true,
    },
    {
      file: "mobile-thread.png",
      path: "/forums/402/threads/902?demo=1",
      heading: "Why does binary search need a sorted array?",
      mobile: true,
    },
  ];
  for (const scene of scenes) {
    // Each scene starts clean; only the saved-items scene seeds demo bookmarks.
    const context = await browser.newContext({
      viewport: scene.mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1080 },
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
      locale: "en-GB",
    });
    const page = await context.newPage();
    await scene.setup?.(page);
    const response = await page.goto(new URL(scene.path, origin).href);
    if (!response?.ok()) throw new Error(`Could not load ${scene.path}`);
    await page
      .getByRole("heading", { name: scene.heading, exact: true })
      .waitFor();
    await scene.prepare?.(page);
    await page.evaluate(() => document.fonts.ready);
    const captureOptions = {
      path: `${output}${scene.file}`,
      animations: "disabled" as const,
      // Keep Next.js development controls out when capturing against next dev.
      style:
        "nextjs-portal, [data-agentation-root], [data-agentation-portal] { display: none !important; }",
    };
    if (scene.dialog) await page.getByRole("dialog").screenshot(captureOptions);
    else await page.screenshot({ ...captureOptions, fullPage: true });
    await context.close();
    console.log(`Captured docs/screenshots/${scene.file}`);
  }
} finally {
  await browser.close();
}
