import { mock } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { upstreamTransport } from "../../src/lib/ilias/upstream-transport";

const id = randomUUID();
mock.module("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: id }) }),
}));

const { saveSession } = await import("../../src/lib/ilias/session");
const { getWorkspace } = await import("../../src/lib/ilias/workspace");
const { clearWorkspacePages } = await import("../../src/lib/ilias/page-cache");

const instance = "https://ilias.uni-freiburg.de/";
await saveSession({
  id,
  instance,
  status: "connected",
  createdAt: Date.now(),
  userName: "Membership test",
});

const html = (body: string) =>
  new Response(body, { headers: { "content-type": "text/html" } });
const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { location } });

const coursePage = (title: string, tabs: string) => `<!doctype html><html><body>
<a href="logout.php">Logout</a>
<h1 class="il-page-content-header">${title}</h1>
<ul id="ilTab">${tabs}</ul>
<p class="ilc_Paragraph">Welcome.</p>
</body></html>`;

const registrationPage = coursePage(
  "Registration course",
  `<li><a href="ilias.php?ref_id=13&baseClass=ilCourseRegistrationGUI&cmd=show">Join course</a></li>`,
);
const memberPage = coursePage(
  "Member course",
  `<li><a href="ilias.php?ref_id=14&cmd=unsubscribe">Leave course</a></li>`,
);
const guestPage = coursePage(
  "Guest course",
  `<li><a href="ilias.php?ref_id=15&cmd=view">Content</a></li>`,
);
const plainPage = (id: string) =>
  coursePage(
    `Course ${id}`,
    `<li><a href="ilias.php?ref_id=${id}&cmd=view">Content</a></li>`,
  );

const membershipItem = (id: string, title: string) =>
  `<div class="il-item"><span class="il-item-title"><a href="goto.php?target=crs_${id}">${title}</a></span></div>`;
const membershipPage = (items: string, pagination = "") => `<!doctype html><html><body>
<a href="logout.php">Logout</a>
<h1>My courses and groups</h1>
${items}
${pagination}
</body></html>`;

let membershipHtml = membershipPage("");
let membershipFails = false;

upstreamTransport.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith("/goto.php")) {
    const target = url.searchParams.get("target");
    if (target === "crs_12")
      return redirect("ilias.php?baseClass=ilDashboardGUI");
    if (target === "crs_13")
      return redirect(
        "ilias.php?ref_id=13&baseClass=ilCourseRegistrationGUI&cmd=show",
      );
    if (target && target.startsWith("crs_"))
      return redirect(`ilias.php?ref_id=${target.slice(4)}&cmd=view`);
  }
  const baseClass = url.searchParams.get("baseClass");
  if (baseClass === "ilDashboardGUI") {
    return html(`<a href="logout.php">Logout</a>
      <h1 class="il-page-content-header">Dashboard</h1>
      <div class="alert">You do not have permission to read this item.</div>
      <div class="ilContainerListItemOuter" id="lg_div_99">
        <h3><a class="il_ContainerItemTitle" href="goto.php?target=crs_99">Dashboard course</a></h3>
      </div>`);
  }
  if (baseClass === "ilMembershipOverviewGUI") {
    if (membershipFails)
      return new Response("temporarily unavailable", { status: 503 });
    return html(membershipHtml);
  }
  const ref = url.searchParams.get("ref_id");
  if (ref === "13") return html(registrationPage);
  if (ref === "14") return html(memberPage);
  if (ref === "15") return html(guestPage);
  if (ref === "16" || ref === "17" || ref === "18") return html(plainPage(ref));
  throw new Error(`Unexpected URL ${url.href}`);
}) as typeof fetch;

// A redirect to the dashboard must not become the course page.
await clearWorkspacePages();
const redirected = await getWorkspace(false, "crs", "12");
assert.equal(redirected.unavailable, true);
assert.match(redirected.error!, /did not open this object/);
assert.equal(redirected.page.title, "Course unavailable");
assert.equal(redirected.page.sourceUrl, instance + "goto.php?target=crs_12");
assert.deepEqual(redirected.page.items, []);
assert.deepEqual(redirected.page.notices, []);

// A registration form for the requested course is a guest page with a join action.
await clearWorkspacePages();
const registration = await getWorkspace(false, "crs", "13");
assert.equal(registration.unavailable, undefined);
assert.equal(registration.page.membership, "guest");
assert.match(registration.page.joinUrl!, /ilCourseRegistrationGUI/);

// A leave action proves membership without loading the membership overview.
await clearWorkspacePages();
const member = await getWorkspace(false, "crs", "14");
assert.equal(member.page.membership, "member");
assert.match(member.page.leaveUrl!, /cmd=unsubscribe/);

// Without a join/leave action, the membership overview supplies the answer.
await clearWorkspacePages();
membershipHtml = membershipPage(membershipItem("101", "Other course"));
const guest = await getWorkspace(false, "crs", "15");
assert.equal(guest.page.membership, "guest");
assert.equal(guest.page.joinUrl, undefined);

await clearWorkspacePages();
membershipHtml = membershipPage(membershipItem("16", "Member course"));
const memberFromList = await getWorkspace(false, "crs", "16");
assert.equal(memberFromList.page.membership, "member");

// A paginated membership list cannot prove absence.
await clearWorkspacePages();
membershipHtml = membershipPage(
  membershipItem("101", "Other course"),
  `<div class="il-viewcontrol-pagination">Next</div>`,
);
const unknown = await getWorkspace(false, "crs", "17");
assert.equal(unknown.page.membership, undefined);

// A failed membership lookup must not break the course page.
await clearWorkspacePages();
membershipFails = true;
const resilient = await getWorkspace(false, "crs", "18");
assert.equal(resilient.page.membership, undefined);
assert.equal(resilient.page.title, "Course 18");
assert.equal(resilient.error, undefined);

console.log("verified");
