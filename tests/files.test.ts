import { expect, test } from "bun:test";
import { downloadResponse } from "../src/lib/ilias/download";
import { fileName } from "../src/lib/file-disposition";
import { itemOpenHref } from "../src/lib/ilias/items";
import type { Item } from "../src/lib/ilias/types";
const upstream = (
  body: BodyInit | null,
  type = "application/octet-stream",
  name = 'attachment; filename="sheet.pdf"',
) =>
  new Response(body, {
    headers: { "content-type": type, "content-disposition": name },
  });
test("verified PDF bytes stream inline without relying on filenames or MIME guesses", async () => {
  const bytes = new TextEncoder().encode("%PDF-1.7\nexample payload\n%%EOF");
  let position = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (position === bytes.length) controller.close();
      else controller.enqueue(bytes.subarray(position, ++position));
    },
  });
  const response = await downloadResponse(upstream(body), "file-1", {
    inlinePdf: true,
  });
  expect(response.headers.get("content-type")).toBe("application/pdf");
  expect(response.headers.get("content-disposition")).toMatch(/^inline/);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("content-security-policy")).not.toContain(
    "sandbox",
  );
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
});
test("a PDF label never permits HTML or a different file format inline", async () => {
  for (const body of [
    "<html><script>alert(1)</script></html>",
    "zip bytes",
    "ab",
    "",
  ]) {
    const response = await downloadResponse(
      upstream(body, "application/pdf"),
      "file-1",
      { inlinePdf: true },
    );
    expect(response.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(response.headers.get("content-security-policy")).toContain(
      "sandbox",
    );
    expect(await response.text()).toBe(body);
  }
  await expect(
    downloadResponse(
      new Response("<form>Login</form>", {
        headers: { "content-type": "text/html" },
      }),
      "file",
      { inlinePdf: true },
    ),
  ).rejects.toMatchObject({ status: 401 });
});
test("explicit downloads stay attachments and cancelling a preview cancels its upstream stream", async () => {
  const download = await downloadResponse(upstream("%PDF-1.7"), "file-1");
  expect(download.headers.get("content-disposition")).toMatch(/^attachment/);
  await download.body?.cancel();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("%PDF-"));
    },
    cancel() {
      cancelled = true;
    },
  });
  const preview = await downloadResponse(upstream(body), "file-1", {
    inlinePdf: true,
  });
  await preview.body?.cancel();
  expect(cancelled).toBe(true);
});
test("standard filename parsing preserves quoted semicolons and Unicode while removing paths", async () => {
  expect(fileName('attachment; filename="week; one.pdf"', "file")).toBe(
    "week; one.pdf",
  );
  expect(
    fileName("attachment; filename*=UTF-8''%C3%9Cbung%2001.pdf", "file"),
  ).toBe("Übung 01.pdf");
  expect(fileName('attachment; filename="../sheet.pdf"', "file")).toBe(
    "sheet.pdf",
  );
  expect(fileName("invalid header;", "safe.pdf")).toBe("safe.pdf");
  const response = await downloadResponse(
    upstream(
      "%PDF-1.7",
      "application/pdf",
      "attachment; filename*=UTF-8''%C3%9Cbung%2001.pdf",
    ),
    "file",
    { inlinePdf: true },
  );
  expect(fileName(response.headers.get("content-disposition"), "file")).toBe(
    "Übung 01.pdf",
  );
  await response.body?.cancel();
});
test("file opening URLs are native viewer targets and ordinary navigation stays intact", () => {
  const item: Item = {
    id: "301",
    type: "file",
    title: "A document",
    sourceUrl: "https://ilias.uni-freiburg.de/goto.php?target=file_301",
    available: true,
    description: "",
    meta: "",
  };
  expect(itemOpenHref(item)).toBe("/api/files/301?view=1");
  expect(itemOpenHref(item, true)).toBe("/api/files/301?demo=1&view=1");
  expect(itemOpenHref({ ...item, type: "crs" })).toBe("/browse/crs/301");
});
