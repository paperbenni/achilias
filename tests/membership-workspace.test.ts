import { test } from "bun:test";
import { runWithIsolatedSessions } from "./helpers/isolated-sessions";

test("course pages expose membership state and reject unrelated redirects", async () => {
  await runWithIsolatedSessions("tests/helpers/membership-workspace.ts");
});
