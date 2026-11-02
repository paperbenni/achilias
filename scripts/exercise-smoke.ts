import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/browse/crs/101?demo=1");
  await page
    .getByRole("button", { name: "Bookmark Exercises / Übungen", exact: true })
    .click();
  await page.getByRole("link", { name: "Bookmarks", exact: true }).click();
  await page
    .getByRole("heading", { name: "Bookmarks.", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "Exercises / Übungen", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Algorithms — Übungen", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("list", { name: "Exercise units" })
      .getByRole("listitem")
      .count(),
    2,
  );
  await page
    .getByRole("link", { name: "Übung 01 — Algorithms", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Übung 01 — Algorithms", exact: true })
    .waitFor();
  const list = page.getByRole("list", {
    name: "Participant submissions",
    exact: true,
  });
  assert.equal(await list.getByRole("listitem").count(), 3);
  for (const name of ["Needs assessment 1", "Missing 1", "Late 1"]) {
    await page.getByRole("radio", { name, exact: true }).click();
    assert.equal(await list.getByRole("listitem").count(), 1);
  }
  await page.getByRole("radio", { name: "All 3", exact: true }).click();
  await page.getByRole("textbox", { name: "Search submissions" }).fill("Maya");
  assert.equal(await list.getByRole("listitem").count(), 1);
  await page.getByRole("textbox", { name: "Search submissions" }).fill("");
  const maya = list.getByRole("listitem").filter({ hasText: "Maya Chen" });
  await maya.getByRole("button", { name: "Assess", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Assessment / Bewertung", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Passed / Bestanden", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Mark or points / Note oder Punkte" })
    .fill("9 / 10");
  await page
    .getByRole("textbox", { name: "Private tutor note / Interne Notiz" })
    .fill("Review task 3 together.");
  await page
    .getByRole("button", { name: "Save demo assessment", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await maya.getByText("9 / 10", { exact: true }).waitFor();
  await page.reload();
  await maya
    .getByText("Private note: Review task 3 together.", { exact: true })
    .waitFor();
  await maya
    .getByRole("button", { name: "Learner feedback", exact: true })
    .click();
  await page
    .getByRole("textbox", {
      name: "Feedback for the learner / Rückmeldung",
      exact: true,
    })
    .fill("Good explanation. Make the invariant explicit.");
  await page
    .getByRole("button", { name: "Save demo feedback", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await maya
    .getByText(
      "Learner feedback: Good explanation. Make the invariant explicit.",
      { exact: true },
    )
    .waitFor();
  await maya
    .getByText("Private note: Review task 3 together.", { exact: true })
    .waitFor();
  await page.route("**/api/files/301?demo=1", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Example session expired. Reconnect to download.",
      }),
    }),
  );
  await maya
    .getByRole("button", { name: "Download submission", exact: true })
    .click();
  await page
    .getByText("Example session expired. Reconnect to download.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    new URL(page.url()).pathname,
    "/exercises/401/units/501",
    "Failed download left the review screen",
  );
  await page.unroute("**/api/files/301?demo=1");
  const downloadEvent = page.waitForEvent("download");
  await maya
    .getByRole("button", { name: "Download submission", exact: true })
    .click();
  const download = await downloadEvent;
  assert.equal(await download.failure(), null);
  assert.equal(download.suggestedFilename(), "achilias-example.pdf");
  await page.getByRole("tab", { name: "Unit settings", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Title / Titel", exact: true })
    .fill("Übung 01 — Updated");
  await page.locator("#unit-deadline").fill("2026-11-10T18:00");
  await page
    .getByRole("textbox", {
      name: "Instructions / Arbeitsanweisung",
      exact: true,
    })
    .fill("Show the loop invariant.");
  await page
    .getByRole("button", { name: "Save demo unit", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Übung 01 — Updated", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "All exercise units", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Algorithms — Übungen", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "New exercise unit", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "New exercise unit", exact: true })
    .waitFor();
  await page
    .getByRole("textbox", { name: "Title / Titel", exact: true })
    .fill("Übung 03 — Graphs");
  await page.locator("#unit-deadline").fill("2026-11-20T18:00");
  await page
    .getByRole("textbox", {
      name: "Instructions / Arbeitsanweisung",
      exact: true,
    })
    .fill("Prove the graph property.");
  await page
    .getByRole("button", { name: "Create demo unit", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Übung 03 — Graphs", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "All exercise units", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Algorithms — Übungen", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "Übung 03 — Graphs", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("list", { name: "Exercise units" })
      .getByRole("listitem")
      .count(),
    3,
  );
  await page
    .getByRole("link", { name: "Übung 02 — Recursion", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Übung 02 — Recursion", exact: true })
    .waitFor();
  const team = list
    .getByRole("listitem")
    .filter({ hasText: "Maya Chen · Jonas Becker" });
  await team.getByRole("button", { name: "Assess", exact: true }).click();
  await page
    .getByText("This assessment applies to the whole team shown in ILIAS.", {
      exact: false,
    })
    .waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Tutor review overflows on mobile",
  );
  const noTeam = list
    .getByRole("listitem")
    .filter({ hasText: "No team assigned" });
  assert.equal(
    await noTeam.getByRole("button", { name: "Assess", exact: true }).count(),
    0,
  );
  assert.equal(
    (
      await page.request.get(
        origin + "/api/exercises/401/units/501/submissions/701",
      )
    ).status(),
    401,
  );
  for (const path of [
    "/exercises/401/units/nope?demo=1",
    "/exercises/999?demo=1",
  ]) {
    await page.goto(origin + path);
    await page
      .getByText("This learning space wasn’t found.", { exact: true })
      .waitFor();
  }
  assert.deepEqual(errors, []);
  console.log(
    "Passed: exercise bookmarks/navigation, review filters/search, assessment and private-note persistence, learner feedback, downloads, unit editing/creation, team scope, mobile layout, download authorization and invalid routes.",
  );
} finally {
  await browser.close();
}
