import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const origin = process.env.ACHILIAS_SCREENSHOT_URL || "http://127.0.0.1:3000";
const output = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  // A fresh context keeps personal account data and saved history out of docs.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "en-GB",
  });
  const page = await context.newPage();
  const scenes = [
    {
      file: "welcome.png",
      path: "/",
      heading: "Less friction. More learning.",
    },
    { file: "overview.png", path: "/?demo=1", heading: "Welcome back, Alex." },
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
  ];
  for (const scene of scenes) {
    if (scene.mobile) await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(new URL(scene.path, origin).href);
    if (!response?.ok()) throw new Error(`Could not load ${scene.path}`);
    await page
      .getByRole("heading", { name: scene.heading, exact: true })
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${output}${scene.file}`,
      fullPage: true,
      animations: "disabled",
      // Keep Next.js development controls out when capturing against next dev.
      style: "nextjs-portal { display: none !important; }",
    });
    console.log(`Captured docs/screenshots/${scene.file}`);
  }
} finally {
  await browser.close();
}
