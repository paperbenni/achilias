import { test } from "bun:test";
import { runWithIsolatedSessions } from "./helpers/isolated-sessions";

test("course lists use memberships, report failures, and course pages reject unrelated redirects", async () => {
  await runWithIsolatedSessions("tests/helpers/membership-workspace.ts");
});
