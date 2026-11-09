import assert from "node:assert/strict";
import { chromium } from "playwright";
import { demoCourses, demoPage } from "../src/lib/ilias/demo";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10_000);
  const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
  const now = Date.now();
  await page.goto(origin + "/courses?demo=1");
  await page.evaluate(({ now, saved }) => {
    localStorage.setItem("achilias:demo:v1", JSON.stringify({
      saved, recent: [], itemVisits: {
        "crs:101": { count: 8, lastOpened: now - 30 * 86400000, score: 8 },
        "crs:102": { count: 1, lastOpened: now, score: 1 },
        "fold:201": { count: 8, lastOpened: now - 30 * 86400000, score: 8 },
        "file:301": { count: 1, lastOpened: now, score: 1 },
      },
    }));
  }, { now, saved: [demoCourses[0], demoPage("crs", "101").items[0]] });
  await page.reload();
  const list = page.locator("#courses .resource-primary");
  const names = () => list.allTextContents();
  async function select(label: string, option: string) {
    await page.getByRole("combobox", { name: label, exact: true }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  }
  await page.getByRole("combobox", { name: "Sort courses" }).waitFor();
  await select("Sort courses", "ILIAS order");
  const original = await names();
  await select("Sort courses", "Name A–Z");
  const alphabetical = [...original].sort(new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare);
  assert.deepEqual(await names(), alphabetical);
  await select("Sort courses", "Name Z–A");
  assert.deepEqual(await names(), [...alphabetical].reverse());
  await page.getByLabel("List view", { exact: true }).click();
  assert.deepEqual(await names(), [...alphabetical].reverse());
  await select("Sort courses", "Most opened");
  assert.equal((await names())[0], demoCourses[0].title);
  await select("Sort courses", "Frecency");
  assert.equal((await names())[0], demoCourses[1].title);
  await select("Sort courses", "Recently opened");
  assert.equal((await names())[0], demoCourses[1].title);
  await select("Sort courses", "Bookmarks first");
  assert.equal((await names())[0], demoCourses[0].title);
  await select("Sort courses", "Name Z–A");
  await page.reload();
  await page.getByRole("combobox", { name: "Sort courses" }).filter({ hasText: "Name Z–A" }).waitFor();
  assert.deepEqual(await names(), [...alphabetical].reverse());
  await page.getByRole("main").getByRole("link", { name: demoCourses[0].title, exact: true }).click();
  await page.waitForURL("**/browse/crs/101?demo=1");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("achilias:demo:v1")!).itemVisits["crs:101"].count), 9);
  const materials = page.getByRole("list", { name: "Learning resources" }).locator(".resource-primary");
  await page.getByRole("combobox", { name: "Sort materials" }).waitFor();
  assert.equal(await page.getByRole("combobox", { name: "Sort materials" }).innerText(), "ILIAS order");
  const originalMaterials = await materials.allTextContents();
  await select("Sort materials", "Name A–Z");
  const sortedMaterials = [...originalMaterials].sort(new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare);
  assert.deepEqual(await materials.allTextContents(), sortedMaterials);
  await select("Sort materials", "Most opened");
  assert.equal((await materials.allTextContents())[0], "Lecture materials");
  await select("Sort materials", "Frecency");
  assert.equal((await materials.allTextContents())[0], "Course handbook.pdf");
  await select("Sort materials", "Bookmarks first");
  assert.equal((await materials.allTextContents())[0], "Lecture materials");
  await select("Sort materials", "Name A–Z");
  await page.getByRole("textbox", { name: "Filter materials" }).fill("Exercises /");
  await materials.nth(1).waitFor({ state: "hidden" });
  assert.equal(await materials.count(), 1);
  await page.getByRole("textbox", { name: "Filter materials" }).fill("");
  await materials.filter({ hasText: "Lecture materials" }).click();
  await page.waitForURL("**/browse/fold/201?demo=1");
  assert.equal(await page.getByRole("combobox", { name: "Sort materials" }).innerText(), "Name A–Z");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("achilias:demo:v1")!).itemVisits["fold:201"].count), 9);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "/tmp/achilias-sorting-mobile.png" });
  console.log("Course/material sorting, visit tracking, preferences, filtering, list layout and mobile width passed");
} finally {
  await browser.close();
}
