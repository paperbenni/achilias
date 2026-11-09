import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "bun:test";
import { GuestMembershipAlert } from "../src/components/workspace/guest-membership-alert";
import { BrowseTabs } from "../src/components/workspace/browse-tabs";
import { LoadErrorAlert } from "../src/components/workspace/error-alert";
import type { IliasPage, Workspace } from "../src/lib/ilias/types";

const page = (overrides: Partial<IliasPage> = {}): IliasPage => ({
  title: "Algorithms",
  description: "",
  items: [],
  tools: [],
  text: [],
  notices: [],
  sourceUrl: "https://ilias.example/goto.php?target=crs_12",
  authenticated: true,
  userName: "Alex",
  hasMore: false,
  ...overrides,
});

const workspace = (overrides: Partial<IliasPage> = {}): Workspace => ({
  mode: "live",
  instance: "https://ilias.example/",
  instanceName: "Example",
  userName: "Alex",
  page: page(overrides),
});

test("guest membership alert explains the status and offers the join action", () => {
  const html = renderToStaticMarkup(
    <GuestMembershipAlert
      page={page({
        membership: "guest",
        joinUrl:
          "https://ilias.example/ilias.php?ref_id=12&baseClass=ilCourseRegistrationGUI&cmd=show",
      })}
      sourceUrl="https://ilias.example/goto.php?target=crs_12"
      objectType="crs"
    />,
  );
  expect(html).toContain("You’re not a member of this course");
  expect(html).toContain("Open membership in ILIAS");
  expect(html).toContain("Join or check your registration status");
});

test("guest membership alert without a join action points to the original page", () => {
  const html = renderToStaticMarkup(
    <GuestMembershipAlert
      page={page({ membership: "guest" })}
      sourceUrl="https://ilias.example/goto.php?target=grp_13"
      objectType="grp"
    />,
  );
  expect(html).toContain("You’re not a member of this group");
  expect(html).toContain("Open in ILIAS");
  expect(html).toContain("Contact the organisers");
});

test("members do not get a guest alert", () => {
  const html = renderToStaticMarkup(
    <GuestMembershipAlert
      page={page({ membership: "member" })}
      sourceUrl="https://ilias.example/goto.php?target=crs_12"
      objectType="crs"
    />,
  );
  expect(html).toBe("");
});

test("unavailable pages do not offer a sign-in retry", () => {
  const html = renderToStaticMarkup(
    <LoadErrorAlert
      title="This learning space isn’t available to you"
      error="ILIAS did not open this object."
      sourceUrl="https://ilias.example/goto.php?target=crs_12"
    />,
  );
  expect(html).toContain("Open in ILIAS");
  expect(html).not.toContain("Sign in again");
});

test("guest course pages use a membership-aware empty state", () => {
  const html = renderToStaticMarkup(
    <BrowseTabs
      library={{ saved: [], recent: [] }}
      data={workspace({ membership: "guest" })}
      demo={false}
      source="https://ilias.example/goto.php?target=crs_12"
      query=""
      onQueryChange={() => {}}
      items={[]}
      total={0}
      itemProps={{
        layout: "grid",
        saved: [],
        demo: false,
        onOpen: () => {},
        onVisit: () => {},
        onToggleSave: () => {},
      }}
      layout="grid"
      onLayoutChange={() => {}}
      empty={(title, description) => <div>{`${title}: ${description}`}</div>}
      objectType="crs"
    />,
  );
  expect(html).toContain("No materials available to guests");
  expect(html).toContain("You’re viewing this course as a guest");
});
