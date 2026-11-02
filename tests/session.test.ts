import { expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { runWithIsolatedSessions } from "./helpers/isolated-sessions";

test("session files are encrypted, private, tamper-resistant, and removed at expiry", async () => {
  await runWithIsolatedSessions(
    "tests/helpers/session-storage.ts",
    async (directory) => {
      expect(await readdir(directory)).toEqual(["session.key"]);
      expect((await readFile(path.join(directory, "session.key"))).length).toBe(
        32,
      );
    },
  );
});
test("single-use connection claims share per-account locks with cancellation", async () => {
  await runWithIsolatedSessions("tests/helpers/session-claim.ts");
});
test("parallel upstream cookie rotations merge and an in-flight request cannot revive logout", async () => {
  await runWithIsolatedSessions("tests/helpers/upstream-session.ts");
});
