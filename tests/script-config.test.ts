import { expect, test } from "bun:test";
import { scriptStringProperties } from "../src/lib/ilias/script-config";
import {
  assessmentInputSchema,
  unitInputSchema,
} from "../src/lib/ilias/exercise-validation";
test("config extraction parses literal JavaScript properties and ignores comments and code examples", () => {
  const script = `// {"ajaxRenderUrl":"comment"}
    const example = '{"ajaxRenderUrl":"quoted code"}';
    setup({ajaxRenderUrl: 'actual\\x2fpath'});
    setup({"ajaxRenderUrl": "/quoted-key"});
    setup({ajaxRenderUrl: location.href});
    setup({["ajaxRenderUrl"]: "computed"});`;
  expect(scriptStringProperties(script, "ajaxRenderUrl")).toEqual([
    "actual/path",
    "/quoted-key",
  ]);
  expect(scriptStringProperties("bad( unfinished", "ajaxRenderUrl")).toEqual(
    [],
  );
});
test("schema validation rejects malformed RPC values and preserves local profile dates", () => {
  expect(
    assessmentInputSchema.safeParse({
      status: "passed",
      version: "ok",
      mark: 12,
    }).success,
  ).toBe(false);
  const valid = {
    title: "Unit",
    start: "2028-02-29T09:00:00",
    deadlineMode: "0",
    deadline: "2028-02-29T09:00",
    lateDeadline: "2028-02-29T09:00",
    mandatory: true,
    version: "ok",
  };
  expect(unitInputSchema.safeParse(valid).success).toBe(true);
  for (const deadline of [
    "2027-02-29T09:00",
    "2028-02-30T09:00",
    "2028-02-29T25:00",
    "2028-02-29T09:00Z",
    "2028-02-29T09:00+01:00",
    "1969-12-31T23:59",
  ])
    expect(unitInputSchema.safeParse({ ...valid, deadline }).success).toBe(
      false,
    );
});
