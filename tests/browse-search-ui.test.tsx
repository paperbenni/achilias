import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "bun:test";
import { BrowseTabs } from "../src/components/workspace/browse-tabs";
import { TooltipProvider } from "../src/components/ui/tooltip";
import type { Item, Workspace } from "../src/lib/ilias/types";

const item = (id: string, title: string): Item => ({
  id,
  type: "file",
  title,
  description: "",
  meta: "",
  sourceUrl: `https://ilias.example/goto.php?target=file_${id}`,
  available: true,
});

const data: Workspace = {
  mode: "demo",
  instance: "https://ilias.example/",
  instanceName: "Example",
  userName: "Alex",
  page: {
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
  },
};

function render(query: string, items: Item[]) {
  return renderToStaticMarkup(
    <TooltipProvider>
      <BrowseTabs
        data={data}
        library={{ saved: [], recent: [] }}
        demo
        source={data.page.sourceUrl}
        objectId="12"
        query={query}
        onQueryChange={() => {}}
        items={items}
        total={items.length}
        itemProps={{
          layout: "grid",
          saved: [],
          demo: true,
          onOpen: () => {},
          onVisit: () => {},
          onToggleSave: () => {},
        }}
        layout="grid"
        onLayoutChange={() => {}}
        empty={(title, description, action) => (
          <div>
            {title}: {description}
            {action}
          </div>
        )}
        objectType="crs"
      />
    </TooltipProvider>,
  );
}

test("a filtered browse list offers a recursive search when few items match", () => {
  const html = render("linear", [item("301", "Linear Algebra notes")]);
  expect(html).toContain("Only one match on this page.");
  expect(html).toContain("Search this course and its subfolders");
});

test("an empty filtered browse list offers a recursive search in the empty state", () => {
  const html = render("linear", []);
  expect(html).toContain("No matching materials");
  expect(html).toContain("search this course and its subfolders");
  expect(html).toContain("Search this course and its subfolders");
});

test("a browse list with enough local matches does not offer a recursive search", () => {
  const html = render("lecture", [
    item("301", "Lecture 1"),
    item("302", "Lecture 2"),
    item("303", "Lecture 3"),
    item("304", "Lecture 4"),
  ]);
  expect(html).not.toContain("Search the whole course?");
  expect(html).not.toContain("Search this course and its subfolders");
});
