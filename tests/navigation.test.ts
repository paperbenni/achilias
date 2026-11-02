import { test } from "bun:test";
import { runWithIsolatedSessions } from "./helpers/isolated-sessions";

test("session-only workspace pages read metadata without making ILIAS requests", async () => {
  await runWithIsolatedSessions("tests/helpers/workspace-metadata.ts");
});
