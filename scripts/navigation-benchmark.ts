import { chromium, type Locator, type Page } from "playwright";
import { writeFile } from "node:fs/promises";
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });
const latency = Number(process.env.ACHILIAS_BENCH_LATENCY || 120);
type Metric = { route: string; milliseconds: number; rscRequests: number };
const results: Metric[] = [];
function byName(page: Page, name: string) {
  return page
    .getByRole("link", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }))
    .first();
}
async function measure(
  page: Page,
  locator: Locator,
  target: string,
  name: string,
) {
  let requests = 0;
  const listener = (request: { url: () => string }) => {
    if (new URL(request.url()).searchParams.has("_rsc")) requests++;
  };
  page.on("request", listener);
  await page.evaluate((heading) => {
    const win = window as typeof window & {
      achiliasMetric?: { start: number; duration?: number };
    };
    const measure = { start: 0, duration: undefined as number | undefined };
    win.achiliasMetric = measure;
    document.addEventListener(
      "click",
      () => {
        measure.start = performance.now();
      },
      { once: true, capture: true },
    );
    const observer = new MutationObserver(() => {
      if (
        measure.start &&
        document.querySelector("h1")?.textContent === heading
      ) {
        observer.disconnect();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            measure.duration = performance.now() - measure.start;
          }),
        );
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }, target);
  await locator.click();
  await page.waitForFunction(() => {
    const metric = (
      window as typeof window & { achiliasMetric?: { duration?: number } }
    ).achiliasMetric;
    return metric?.duration !== undefined;
  });
  const duration = await page.evaluate(
    () =>
      (window as typeof window & { achiliasMetric: { duration: number } })
        .achiliasMetric.duration,
  );
  page.off("request", listener);
  results.push({
    route: name,
    milliseconds: Math.round(duration),
    rscRequests: requests,
  });
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency,
    downloadThroughput: 2_000_000,
    uploadThroughput: 1_000_000,
  });
  await page.goto(origin + "/?demo=1");
  await page
    .getByRole("heading", { name: "Welcome back, Alex.", exact: true })
    .waitFor();
  // Allow production's automatic link prefetches to finish before measuring.
  await page.waitForTimeout(1500);
  await measure(
    page,
    byName(page, "Features & connection"),
    "A clear view of what’s here.",
    "Overview → Settings",
  );
  await page.waitForTimeout(500);
  await measure(
    page,
    byName(page, "Saved for later"),
    "Saved for later.",
    "Settings → Saved",
  );
  await measure(
    page,
    byName(page, "Overview"),
    "Welcome back, Alex.",
    "Saved → Overview",
  );
  await page.waitForTimeout(1000);
  await measure(
    page,
    byName(page, "Introduction to Computer Science"),
    "Introduction to Computer Science",
    "Overview → Course",
  );
  await page.waitForTimeout(600);
  await measure(
    page,
    byName(page, "Lecture materials"),
    "Lecture materials",
    "Course → Folder",
  );
  await measure(
    page,
    byName(page, "Overview"),
    "Welcome back, Alex.",
    "Folder → Overview",
  );
  await measure(
    page,
    byName(page, "Introduction to Computer Science"),
    "Introduction to Computer Science",
    "Overview → Course (repeat)",
  );
  await measure(
    page,
    byName(page, "Questions & discussion"),
    "Questions & discussion",
    "Course → Forum",
  );
  await page.waitForTimeout(600);
  await measure(
    page,
    page.getByRole("link", {
      name: /Why does binary search need a sorted array\? Maya/,
    }),
    "Why does binary search need a sorted array?",
    "Forum → Thread",
  );
  await measure(
    page,
    byName(page, "Questions & discussion"),
    "Questions & discussion",
    "Thread → Forum (repeat)",
  );
  await measure(
    page,
    page.getByRole("link", {
      name: /Why does binary search need a sorted array\? Maya/,
    }),
    "Why does binary search need a sorted array?",
    "Forum → Thread (repeat)",
  );
  const report = {
    environment:
      "Production build; demo content; desktop Chromium; synthetic browser network latency. Not a comparison against authenticated Freiburg ILIAS.",
    latencyMs: latency,
    results,
  };
  if (process.env.ACHILIAS_BENCH_OUTPUT)
    await writeFile(
      process.env.ACHILIAS_BENCH_OUTPUT,
      JSON.stringify(report, null, 2) + "\n",
    );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
