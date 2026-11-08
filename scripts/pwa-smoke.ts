import { chromium, devices } from "playwright";
import assert from "node:assert/strict";

// Use a production preview: the dev server intentionally registers no worker.
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/settings");
  await page.getByRole("heading", { name: "Features & connection" }).waitFor();
  assert.match(await page.locator('meta[name="viewport"]').getAttribute("content") || "", /viewport-fit=cover/);
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  assert.ok(manifestHref);
  const manifestResponse = await context.request.get(new URL(manifestHref, origin).href);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.name, "Achilias");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.id, "/");
  for (const icon of manifest.icons) {
    const response = await context.request.get(origin + icon.src);
    const png = await response.body();
    assert.equal(response.status(), 200);
    assert.equal(png.readUInt32BE(16), Number(icon.sizes.split("x")[0]));
    assert.equal(png.readUInt32BE(20), Number(icon.sizes.split("x")[1]));
  }
  assert.match(await page.locator('link[rel="apple-touch-icon"]').getAttribute("href") || "", /apple-touch-icon/);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.getByText("Offline launch is ready on this device.", { exact: true }).waitFor();
  const workerResponse = await context.request.get(origin + "/sw.js");
  assert.match(workerResponse.headers()["content-type"], /javascript/);
  assert.match(workerResponse.headers()["cache-control"], /no-store/);
  assert.equal(await workerResponse.text(), await (await context.request.get(origin + "/sw.js")).text(),
    "The worker changed between requests instead of between builds");

  const cdp = await context.newCDPSession(page);
  const installability = await cdp.send("Page.getInstallabilityErrors");
  assert.deepEqual(installability.installabilityErrors, []);
  const cachePaths = () => page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of await caches.keys()) {
      if (!name.startsWith("achilias-shell-")) continue;
      for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);
    }
    return paths.sort();
  });
  const publicPaths = ["/offline.html", "/offline.css", "/offline.js", "/icons/app-192.png", "/icons/app-512.png", "/icons/apple-touch-icon.png"].sort();
  assert.deepEqual(await cachePaths(), publicPaths);
  await page.evaluate(() => fetch("/api/session").then((response) => response.json()));
  await page.goto(origin + "/browse/crs/101?demo=1");
  await page.getByRole("heading", { name: "Introduction to Computer Science", exact: true }).waitFor();
  assert.deepEqual(await cachePaths(), publicPaths, "Account pages entered the offline cache");

  // An open app reports connection loss. Failed APIs must not receive offline HTML.
  await context.setOffline(true);
  await page.getByText("You’re offline. Reconnect to load content or save changes.", { exact: true }).waitFor();
  const apiResult = await page.evaluate(() => fetch("/api/session").then(() => "unexpected response", () => "network failure"));
  assert.equal(apiResult, "network failure");
  await page.goto(origin + "/courses");
  await page.getByRole("heading", { name: "Let's get you connected." }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/courses");
  assert.equal(await page.locator("img").evaluate((img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth === 192), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.deepEqual(await cachePaths(), publicPaths);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again" }).tap();
  await page.getByRole("heading", { name: "Sign in to ILIAS", exact: true }).waitFor();

  // A different worker URL exercises a real waiting worker on this browser,
  // without modifying the preview build or requesting any production writes.
  await page.goto(origin + "/?demo=1");
  const filter = page.getByRole("textbox", { name: "Filter courses and materials" });
  await filter.fill("draft stays put");
  const otherTab = await context.newPage();
  otherTab.on("pageerror", (error) => errors.push(error.message));
  await otherTab.goto(origin + "/?demo=1");
  const otherFilter = otherTab.getByRole("textbox", { name: "Filter courses and materials" });
  await otherFilter.fill("other tab draft");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js?revision=pwa-smoke-1", { scope: "/", updateViaCache: "none" });
  });
  await page.getByRole("button", { name: "Reload to update" }).waitFor();
  assert.equal(await filter.inputValue(), "draft stays put");
  await page.getByRole("button", { name: "Later", exact: true }).tap();
  assert.equal(await filter.inputValue(), "draft stays put");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js?revision=pwa-smoke-2", { scope: "/", updateViaCache: "none" });
  });
  await page.getByRole("button", { name: "Reload to update" }).tap();
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes("pwa-smoke-2"));
  await page.waitForFunction(() => (document.querySelector('input[aria-label="Filter courses and materials"]') as HTMLInputElement)?.value === "");
  await otherTab.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes("pwa-smoke-2"));
  assert.equal(await otherFilter.inputValue(), "other tab draft", "Updating one tab reloaded another tab's form");
  await otherTab.close();

  // Exercise the optional native prompt without invoking browser/OS install UI.
  await page.goto(origin + "/settings?demo=1");
  await page.getByText("Achilias on your device", { exact: true }).waitFor();
  await page.evaluate(() => {
    const prompt = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(prompt, {
      prompt: async () => { document.documentElement.dataset.installPrompt = "called"; },
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(prompt);
  });
  assert.equal(await page.locator("html").getAttribute("data-install-prompt"), null);
  await page.getByRole("button", { name: "Install Achilias", exact: true }).tap();
  assert.equal(await page.locator("html").getAttribute("data-install-prompt"), "called");
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await page.getByText("Achilias is installed", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await context.close();

  const ios = await browser.newContext({ ...devices["iPhone 13"] });
  const iphone = await ios.newPage();
  await iphone.goto(origin + "/settings");
  await iphone.getByText(/On iPhone or iPad, open the browser’s Share menu/).waitFor();
  await iphone.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
  await iphone.reload();
  await iphone.getByText("Achilias is installed", { exact: true }).waitFor();
  assert.equal(await iphone.getByRole("button", { name: "Install Achilias", exact: true }).count(), 0);
  await ios.close();
  console.log("Passed: installability, icons, production worker, private-cache boundaries, offline recovery, API failures, optional installation, and explicit updates.");
} finally {
  await browser.close();
}
