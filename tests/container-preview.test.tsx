import { afterEach, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ContainerPreviewContent } from "../src/components/workspace/container-preview";
import { getContainerPreview } from "../src/lib/ilias/container-preview";
import { clearWorkspacePages } from "../src/lib/ilias/page-cache";
import { upstreamTransport } from "../src/lib/ilias/upstream-transport";
import type { Session } from "../src/lib/ilias/session";
import type { ContainerPreviewData } from "../src/lib/ilias/types";

const instance = "https://campus.example/";
const account: Session = {
  id: "container-preview-user",
  instance,
  status: "pending",
  createdAt: Date.now(),
};
const original = upstreamTransport.fetch;
afterEach(async () => {
  upstreamTransport.fetch = original;
  await clearWorkspacePages();
});

const listing = (items: string) => `
  <a href="logout.php">Logout</a>
  <h1>Kommunikationssysteme</h1>
  ${items}
`;

const item = (id: string, title: string) => `
  <div class="il-item">
    <span class="il-item-title">
      <a href="goto.php?target=cat_${id}">${title}</a>
    </span>
  </div>
`;

test("previews the first listing page of a category with bounded entries", async () => {
  upstreamTransport.fetch = async (input) => {
    const url = new URL(String(input));
    expect(url.searchParams.get("target")).toBe("cat_1056902");
    return new Response(
      listing(
        [
          item("1001", "Algorithms"),
          item("1002", "Databases"),
          item("1003", "Computer networks"),
          item("1004", "Operating systems"),
        ].join(""),
      ),
      { headers: { "content-type": "text/html" } },
    );
  };

  const preview = await getContainerPreview(account, "cat", "1056902");
  expect(preview.count).toBe(4);
  expect(preview.items.map((entry) => entry.title)).toEqual([
    "Algorithms",
    "Databases",
    "Computer networks",
  ]);
  expect(preview.truncated).toBe(true);
  expect(preview.hasMore).toBe(false);
});

test("an empty category reports that no visible items were found", async () => {
  upstreamTransport.fetch = async () =>
    new Response(listing(""), {
      headers: { "content-type": "text/html" },
    });

  const preview = await getContainerPreview(account, "cat", "1056903");
  expect(preview).toEqual({
    count: 0,
    items: [],
    truncated: false,
    hasMore: false,
  });
});

test("previews reject non-containers and redirected pages", async () => {
  let calls = 0;
  upstreamTransport.fetch = async (input) => {
    calls++;
    const url = new URL(String(input));
    if (url.pathname.endsWith("goto.php"))
      return new Response(null, {
        status: 302,
        headers: { location: "ilias.php?baseClass=ilDashboardGUI" },
      });
    return new Response(listing(""), {
      headers: { "content-type": "text/html" },
    });
  };

  await expect(getContainerPreview(account, "crs", "1056904")).rejects.toThrow(
    "Invalid category or folder",
  );
  expect(calls).toBe(0);
  await expect(getContainerPreview(account, "cat", "1056904")).rejects.toThrow(
    "did not open this category or folder",
  );
});

const preview: ContainerPreviewData = {
  count: 4,
  items: [
    { type: "cat", title: "Algorithms" },
    { type: "cat", title: "Databases" },
    { type: "cat", title: "Computer networks" },
  ],
  truncated: true,
  hasMore: true,
};

test("cards show the item count, first entries, and an ellipsis for the rest", () => {
  const html = renderToStaticMarkup(
    <ContainerPreviewContent preview={preview} type="cat" />,
  );
  expect(html).toContain("4+ items");
  expect(html).toContain("Algorithms");
  expect(html).toContain("Computer networks");
  expect(html).toContain("…");
});

test("empty cards and list rows use compact, type-aware wording", () => {
  const empty = renderToStaticMarkup(
    <ContainerPreviewContent
      preview={{ count: 0, items: [], truncated: false, hasMore: false }}
      type="fold"
    />,
  );
  expect(empty).toContain("No visible items in this folder");

  const row = renderToStaticMarkup(
    <ContainerPreviewContent preview={preview} type="cat" variant="row" />,
  );
  expect(row).toContain("4+ items · Algorithms, Databases, Computer networks");
  expect(row).toContain("…");
});
